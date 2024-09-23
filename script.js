// ------------------------------ RANDOM ------------------------------
class Random {
  int(min, max) { }
  float(min, max) { }
  random() { }
}

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
  float(min, max) {
    return min + this.mt.rnd() * (max - min);
  }
  random() {
    return this.mt.rnd();
  }
}

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
  export() { return toString(this.value); }
  /// configures the given form element, for example by setting the min and max values.
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
  hide() { document.getElementById(this.sectionName).classList.add("hidden"); }
  /// shows the section of this generator.
  show() { document.getElementById(this.sectionName).classList.remove("hidden"); }

  /// reads the values from the form elements
  readForm() {
    for(let key in this) {
      let obj = this[key];
      if(obj instanceof Value) {
        obj.value = obj.parse(this.#getElement(key).value);
      }
    }
  }
  /// writes the values to the form elements by calling configureForm on all value properties.
  configureForm() {
    for(let key in this) {
      let obj = this[key];
      if(obj instanceof Value) {
        obj.configureForm(this.#getElement(key));
      }
    }
  }

  /// reads the values from the url parameters by calling readParams on all value properties.
  readParams(urlParams) {
    for(let key in this) {
      this[key].value = this[key].parse(urlParams.get(key));
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

// ------------------------------ SETUP HTML ------------------------------
function attachToHtml() {
  function hideAllGenerators() {
    generators.forEach(gen => gen.hide());
  }
  function select(name) {
    hideAllGenerators();
    let selected = generators.find(gen => gen.sectionName === name);
    if(selected) {
      selected.configureForm();
      selected.show();
    }
  }

  let rnd = new MersenneRandom(123);

  let selector = document.getElementById("select-generator");
  selector.addEventListener("change", e => select(e.target.value));
  document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      let selected = generators.find(gen => gen.sectionName === selector.value);
      if(selected) {
        selected.readForm();
        document.getElementById("result").innerHTML = selected.generate(rnd);
      }
    });
  });
  let urlParams = new URLSearchParams(window.location.search);
  if(urlParams.has("generator")) {
    selector.value = urlParams.get("generator");
    let selected = generators.find(gen => gen.sectionName === selector.value);
    if(selected) {
      selected.readParams(urlParams);
      selected.configureForm();
      selected.show();
      document.getElementById("result").innerHTML = selected.generate(rnd);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  attachToHtml();
});
