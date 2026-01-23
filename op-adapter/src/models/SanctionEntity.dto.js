export default class SanctionEntity {
  constructor({
    id,
    name,
    schema,
    score,
    birthDate,
    birthPlace,
    gender,
    nationality = [],
    country = [],
    position = [],
    notes = [],
    alias = [],
    address = [],
    datasets = [],
    isSanctioned = false,
    isPep = false,
  }) {
    this.id = id;
    this.name = name;
    this.schema = schema;
    this.score = score;
    this.birthDate = birthDate;
    this.birthPlace = birthPlace;
    this.gender = gender;
    this.nationality = nationality;
    this.country = country;
    this.position = position;
    this.notes = notes;
    this.alias = alias;
    this.address = address;
    this.datasets = datasets;
    this.isSanctioned = isSanctioned;
    this.isPep = isPep;
  }

  static fromYenteResponse(item) {
    const properties = item?.properties || {};
    const topics = properties.topics || [];

    const pickFirst = (propName) => {
      const values = properties[propName];
      return Array.isArray(values) && values.length > 0 ? values[0] : null;
    };

    const pickList = (propName) => {
      const values = properties[propName];
      return Array.isArray(values) ? values : [];
    };

    return new SanctionEntity({
      id: item?.id,
      name: item?.caption,
      schema: item?.schema,
      score: item?.score,
      birthDate: pickFirst('birthDate'),
      birthPlace: pickFirst('birthPlace'),
      gender: pickFirst('gender'),
      nationality: pickList('nationality'),
      country: pickList('country'),
      position: pickList('position'),
      notes: pickList('notes'),
      alias: pickList('alias'),
      address: pickList('address'),
      datasets: Array.isArray(item?.datasets) ? item.datasets : [],
      isSanctioned: topics.includes('sanction'),
      isPep: topics.includes('role.pep'),
    });
  }
}
