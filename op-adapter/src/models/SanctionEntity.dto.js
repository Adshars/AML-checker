export default class SanctionEntity {
  constructor(data) {
    this.id = data.id;
    this.schema = data.schema;
    
    // KLUCZOWE: Przekazujemy surowy obiekt properties dalej
    this.properties = data.properties || {};

    // Helper properties for basic fields (Yente always returns arrays in properties!)
    this.name = this.properties.name ? this.properties.name[0] : (data.caption || 'Unknown');
    this.country = this.properties.country || []; 
    this.datasets = data.datasets || [];
  }

  static fromYenteResponse(item) {
    return new SanctionEntity({
      id: item.id,
      schema: item.schema,
      properties: item.properties || {}, // Capture all data here
      caption: item.caption,
      datasets: item.datasets || []
    });
  }
}
