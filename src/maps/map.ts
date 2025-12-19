import "leaflet/dist/leaflet.css";
import { Mesh, MeshStandardMaterial, PlaneGeometry } from "three";

const ELEVATION_SCALE = 0.01;
const BOUNDS = { north: 35.39, south: 35.33, east: 138.78, west: 138.69 };
const RESOLUTION = 0.001; // should be smaller in power than BOUNDS
const SIZE_X = Math.ceil((BOUNDS.east - BOUNDS.west) / RESOLUTION);
const SIZE_Y = Math.ceil((BOUNDS.north - BOUNDS.south) / RESOLUTION);

export default class TerrainData {
  ground: Mesh = new Mesh();

  constructor() {}

  async setup() {
    // Get terrain data
    const terrainData = await this.getTerrainData(BOUNDS, RESOLUTION);

    // find highest point
    let maxElevation = -Infinity;
    for (const point of terrainData) {
      if (point.elevation > maxElevation) {
        maxElevation = point.elevation;
      }
    }
    console.log(`Max elevation: ${maxElevation} meters`);

    // Create geometry with segments matching our data points
    const groundGeometry = new PlaneGeometry(
      SIZE_X - 1,
      SIZE_Y - 1,
      SIZE_X - 1,
      SIZE_Y - 1
    );

    // Apply elevation data to geometry vertices
    this.applyElevationToGeometry(groundGeometry, terrainData, BOUNDS);
    groundGeometry.computeVertexNormals(); // Recalculate normals for proper lighting

    // Create material
    const groundMaterial = new MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });

    // Create ground mesh
    const ground = new Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;

    this.ground = ground;
    return ground;
  }

  private applyElevationToGeometry(
    geometry: PlaneGeometry,
    terrainData: { lat: number; lng: number; elevation: number }[],
    bounds: { north: number; south: number; east: number; west: number }
  ): void {
    const vertices = geometry.attributes.position;
    console.log(vertices.count, terrainData.length);
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i) + (SIZE_X - 1) / 2;
      const y = vertices.getY(i) + (SIZE_Y - 1) / 2;

      // Set vertex Z position to elevation
      let index = y * SIZE_X + x;
      // console.log(
      //   `Vertex ${i}: x=${x}, y=${y}, index=${index}, elevation=${terrainData[index]?.elevation}`
      // );
      vertices.setZ(i, terrainData[index]?.elevation * ELEVATION_SCALE);
    }
    vertices.needsUpdate = true;
  }

  async getTerrainData(
    bounds: { north: number; south: number; east: number; west: number },
    resolution: number = 10
  ): Promise<{ lat: number; lng: number; elevation: number }[]> {
    const locations: { latitude: number; longitude: number }[] = [];

    // Using 1e5 to avoid floating point precision issues
    for (
      let lat = bounds.south * 1e5;
      lat <= bounds.north * 1e5;
      lat += resolution * 1e5
    ) {
      for (
        let lng = bounds.west * 1000;
        lng <= bounds.east * 1e5;
        lng += resolution * 1e5
      ) {
        locations.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
      }
    }
    console.log(`Locations: ${locations.length}`);

    try {
      const response = await fetch(
        "https://api.open-elevation.com/api/v1/lookup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locations: locations }),
        }
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error("Error fetching terrain data:", error);
      return [];
    }
  }
}
