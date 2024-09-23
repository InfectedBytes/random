// ------------------------------ RANDOM ------------------------------
/// represents a random number generator.
class Random {
  /// returns a random integer between min and max (inclusive).
  int(_min, _max) { }
  /// returns a random float between min and max.
  float(_min, _max) { }
  /// returns a random float between 0 and 1.
  random() { }
}

/// represents a random number generator based on the Mersenne Twister algorithm.
class MersenneRandom extends Random {
  constructor(seed) {
    super();
    this.mt = new MersenneTwister(seed);
  }
  int(min, max) {
    const range = max - min + 1;
    const rnd = this.mt.int() % range;
    return min + rnd;
  }
  float(min, max) { return min + this.mt.rnd() * (max - min); }
  random() { return this.mt.rnd(); }
}

/// generates a hash value from the given value.
function hash(value) {
  str = value.toString();
  let result = 0;
  for(let i = 0; i < str.length; i++) {
    result = ((result << 5) - result) + str.charCodeAt(i);
    result |= 0; // Convert to 32bit integer
  }
  return result;
}

// ------------------------------ VALUES ------------------------------

/// represents a value that can be parsed from a string and configured in a form element.
class Value {
  value;
  /// receives a string value and parses it to an appropriate type.
  parse(value) { return value; }
  /// returns the string representation of the value, used for exporting the value in the url.
  export() { return this.value?.toString() || ""; }
  /// configures the given form element, for example by setting the min and max values of the form element.
  configureForm(_element) { }
}


/// represents an integer value with a minimum and maximum value.
class IntValue extends Value {
  constructor(min, max, value) {
    super();
    this.min = min;
    this.max = max;
    this.value = value;
  }
  parse(value) { return Math.min(Math.max(parseInt(value), this.min), this.max); }
  configureForm(element) {
    element.type = "number";
    element.min = this.min;
    element.max = this.max;
    element.value = this.value;
  }
}

/// represents a list of strings, separated by newlines.
class StringListValue extends Value {
  value = [];
  parse(value) { return value.split("\n").map(v => v.trim()).filter(v => v.length > 0); }
  export() { return this.value.join("\n"); }
  configureForm(element) { element.value = this.export(); }
}


// ------------------------------ GENERATORS ------------------------------

/// represents a generator that generates random values based on its parameters.
class Generator {
  /// returns the prefix for the section name.
  /// this is the lowercase name of the class without the "generator" suffix.
  /// all html elements for this generator should have this prefix, followed by a dash and the property name.
  /// for example `int-min` for the min property of the IntGenerator.
  get prefix() { return this.constructor.name.toLowerCase().replace("generator", ""); }

  /// returns the section name for this generator, which is used as the id of the section in the html.
  /// this is the prefix followed by "-gen".
  /// for example "int-gen" for the IntGenerator.
  get sectionName() { return `${this.prefix}-gen`; }

  /// returns the element with the given name, prefixed with the prefix of this generator.
  #getElement(name) { return document.getElementById(`${this.prefix}-${name}`); }

  /// hides the section of this generator.
  hide() { document.getElementById(this.sectionName)?.classList?.add("hidden"); }
  /// shows the section of this generator.
  show() { document.getElementById(this.sectionName)?.classList?.remove("hidden"); }

  /// reads the values from the form elements
  readForm() {
    for(let key in this) {
      let obj = this[key];
      if(obj instanceof Value) {
        let element = this.#getElement(key);
        if(element) obj.value = obj.parse(element.value);
      }
    }
  }
  /// writes the values to the form elements by calling configureForm on all value properties.
  configureForm() {
    for(let key in this) {
      let obj = this[key];
      if(obj instanceof Value) {
        let element = this.#getElement(key);
        if(element) obj.configureForm(element);
      }
    }
  }

  /// reads the values from the url parameters by calling readParams on all value properties.
  readParams(urlParams) {
    for(let key in this) {
      let obj = this[key];
      if(obj instanceof Value) {
        this[key].value = this[key].parse(urlParams.get(key));
      }
    }
  }

  exportParams(urlParams) {
    for(let key in this) {
      let obj = this[key];
      if(obj instanceof Value) {
        urlParams.set(key, this[key].export());
      }
    }
  }

  /// generates the values and returns them as already formatted html string.
  generate(_rnd) { }
}

class IntGenerator extends Generator {
  min = new IntValue(0, 100, 0);
  max = new IntValue(0, 100, 100);
  count = new IntValue(1, 100, 1);

  generate(rnd) {
    let result = [];
    for(let i = 0; i < this.count.value; i++) {
      result.push(rnd.int(this.min.value, this.max.value));
    }
    return `<pre>${result.join("\n")}</pre>`;
  }
}

class ListGenerator extends Generator {
  input = new StringListValue();

  generate(rnd) {
    let shuffled = this.input.value
      .map(value => ({ value, sort: rnd.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ value }) => value)
    return `<pre>${shuffled.join("\n")}</pre>`;
  }
}

// ------------------------------ GENERATORS ------------------------------
const generators = [new IntGenerator(), new ListGenerator()];

// ------------------------------ APPLICATION ------------------------------
/// represents the main application.
/// this class is responsible for managing the selected generator and the form elements.
/// it also handles the url parameters and the generation of the random values.
/// UI is optional, thus all operations must work with and without UI.
class App {
  selected;
  seed = "";

  /// clears the form and the result.
  clear() {
    document.getElementById("select-generator").selectedIndex = 0;
    this.select("");
    document.getElementById("result").innerHTML = "";
  }

  /// hides all generators.
  #hideAllGenerators() {
    generators.forEach(gen => gen.hide());
  }
  /// selects the generator with the given name, hides all other generators and shows the selected generator.
  select(name) {
    this.selected = generators.find(gen => gen.sectionName === name);
    this.configureForm();
  }
  configureForm() {
    this.#hideAllGenerators();
    let controls = document.getElementById("shared-controls");
    if(this.selected) {
      this.selected.configureForm();
      this.selected.show();
      controls?.classList?.remove("hidden");
    } else {
      controls?.classList?.add("hidden");
    }
    let selector = document.getElementById("select-generator");
    if(selector) selector.value = this.selected?.sectionName || "";
    let seed = document.getElementById("seed");
    if(seed) seed.value = this.seed;
  }
  /// parses the url parameters and selects the generator with the given name.
  /// it then generates the values and displays them.
  parseSearch(urlParams) {
    if(urlParams.has("generator")) {
      this.seed = urlParams.get("seed") || "";
      this.select(urlParams.get("generator"));
      if(this.selected) {
        this.selected.readParams(urlParams);
        this.selected.configureForm();
        this.generate();
      }
    }
  }
  /// generates the values and displays them.
  generate() {
    if(this.selected) {
      this.selected.readForm();
      let seed = hash(this.seed || Math.random());
      document.getElementById("result").innerHTML = this.selected.generate(new MersenneRandom(seed));
    }
  }
  /// copies the url with the current generator and parameters to the clipboard.
  copyQuery() {
    if(this.selected) {
      this.selected.readForm();
      let url = new URL(window.location);
      let urlParams = new URLSearchParams();
      urlParams.set("generator", this.selected.sectionName);
      this.selected.exportParams(urlParams);
      url.search = urlParams.toString();
      navigator.clipboard.writeText(url.href);
    }
  }
}

app = new App();

document.addEventListener("DOMContentLoaded", () => {
  app.parseSearch(new URLSearchParams(window.location.search));
});