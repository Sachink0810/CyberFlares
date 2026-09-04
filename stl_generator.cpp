#include <iostream>
#include <fstream>
#include <vector>
#include <cmath>
#include <algorithm>
#include <gdal_priv.h>

// Binary STL triangle format (exactly 50 bytes per facet)
#pragma pack(push, 1)
struct STLTriangle {
    float normal[3] = {0.0f, 0.0f, 0.0f};
    float v1[3], v2[3], v3[3];
    uint16_t attribute_byte_count = 0;
};
#pragma pack(pop)

// Helper function to stream a triangle directly to disk
void writeTriangle(std::ofstream& out, const float* v1, const float* v2, const float* v3, uint32_t& count) {
    STLTriangle tri;
    for(int i = 0; i < 3; ++i) {
        tri.v1[i] = v1[i];
        tri.v2[i] = v2[i];
        tri.v3[i] = v3[i];
    }
    out.write(reinterpret_cast<const char*>(&tri), sizeof(STLTriangle));
    count++;
}

int main() {
    // 1. Initialize GDAL and load the raster
    GDALAllRegister();
    const char* tiff_path = "Machchhu_NearField_5km.tif"; // Ensure you cropped this via gdal_translate
    GDALDataset* dataset = (GDALDataset*) GDALOpen(tiff_path, GA_ReadOnly);
    
    if (dataset == nullptr) {
        std::cerr << "Error: Could not open " << tiff_path << std::endl;
        return 1;
    }

    GDALRasterBand* band = dataset->GetRasterBand(1);
    int cols = band->GetXSize();
    int rows = band->GetYSize();
    
    double transform[6];
    dataset->GetGeoTransform(transform);

    // 2. Extract elevation and handle NoData values
    std::vector<float> elevation(cols * rows);
    band->RasterIO(GF_Read, 0, 0, cols, rows, elevation.data(), cols, rows, GDT_Float32, 0, 0);
    
    int hasNodata = 0;
    float nodata = band->GetNoDataValue(&hasNodata);
    float min_z = 10000.0f;

    for (float z : elevation) {
        if ((!hasNodata || z != nodata) && z < min_z) {
            min_z = z;
        }
    }
    for (float& z : elevation) {
        if (hasNodata && z == nodata) z = min_z;
    }

    // Set a solid base height 10 meters below the lowest terrain point
    float base_height = min_z - 10.0f;

    // 3. Project Degrees to Cartesian Meters (Centered at origin)
    double lat_center = 22.763;
    double m_per_deg_lat = 111320.0;
    double m_per_deg_lon = 111320.0 * std::cos(lat_center * M_PI / 180.0);

    std::vector<float> X(cols), Y(rows);
    for (int c = 0; c < cols; ++c) X[c] = (c * transform[1]) * m_per_deg_lon;
    for (int r = 0; r < rows; ++r) Y[r] = (r * transform[5]) * m_per_deg_lat;

    auto Z = [&](int r, int c) { return elevation[r * cols + c]; };

    // 4. Open Binary STL File and prepare headers
    std::ofstream stl_file("Machchhu_Watertight.stl", std::ios::binary);
    char header[80] = {0};
    stl_file.write(header, 80);
    
    uint32_t total_triangles = 0;
    stl_file.write(reinterpret_cast<const char*>(&total_triangles), sizeof(uint32_t));

    std::cout << "Streaming mesh to disk..." << std::endl;

    // 5. Generate Top Surface
    for (int r = 0; r < rows - 1; ++r) {
        for (int c = 0; c < cols - 1; ++c) {
            float v0[3] = {X[c], Y[r], Z(r,c)};
            float v1[3] = {X[c+1], Y[r], Z(r,c+1)};
            float v2[3] = {X[c], Y[r+1], Z(r+1,c)};
            float v3[3] = {X[c+1], Y[r+1], Z(r+1,c+1)};
            writeTriangle(stl_file, v0, v1, v2, total_triangles);
            writeTriangle(stl_file, v1, v3, v2, total_triangles);
        }
    }

    // 6. Generate North Wall (r = 0)
    for(int c = 0; c < cols - 1; ++c) {
        float v0t[3] = {X[c], Y[0], Z(0, c)}, v1t[3] = {X[c+1], Y[0], Z(0, c+1)};
        float v0b[3] = {X[c], Y[0], base_height}, v1b[3] = {X[c+1], Y[0], base_height};
        writeTriangle(stl_file, v0t, v0b, v1t, total_triangles);
        writeTriangle(stl_file, v1t, v0b, v1b, total_triangles);
    }

    // 7. Generate South Wall (r = rows - 1)
    for(int c = 0; c < cols - 1; ++c) {
        int r = rows - 1;
        float v0t[3] = {X[c], Y[r], Z(r, c)}, v1t[3] = {X[c+1], Y[r], Z(r, c+1)};
        float v0b[3] = {X[c], Y[r], base_height}, v1b[3] = {X[c+1], Y[r], base_height};
        writeTriangle(stl_file, v0t, v1t, v0b, total_triangles);
        writeTriangle(stl_file, v1t, v1b, v0b, total_triangles);
    }

    // 8. Generate West Wall (c = 0)
    for(int r = 0; r < rows - 1; ++r) {
        float v0t[3] = {X[0], Y[r], Z(r, 0)}, v1t[3] = {X[0], Y[r+1], Z(r+1, 0)};
        float v0b[3] = {X[0], Y[r], base_height}, v1b[3] = {X[0], Y[r+1], base_height};
        writeTriangle(stl_file, v0t, v1t, v0b, total_triangles);
        writeTriangle(stl_file, v1t, v1b, v0b, total_triangles);
    }

    // 9. Generate East Wall (c = cols - 1)
    for(int r = 0; r < rows - 1; ++r) {
        int c = cols - 1;
        float v0t[3] = {X[c], Y[r], Z(r, c)}, v1t[3] = {X[c], Y[r+1], Z(r+1, c)};
        float v0b[3] = {X[c], Y[r], base_height}, v1b[3] = {X[c], Y[r+1], base_height};
        writeTriangle(stl_file, v0t, v0b, v1t, total_triangles);
        writeTriangle(stl_file, v1t, v0b, v1b, total_triangles);
    }

    // 10. Generate Bottom Surface
    for (int r = 0; r < rows - 1; ++r) {
        for (int c = 0; c < cols - 1; ++c) {
            float v0[3] = {X[c], Y[r], base_height};
            float v1[3] = {X[c+1], Y[r], base_height};
            float v2[3] = {X[c], Y[r+1], base_height};
            float v3[3] = {X[c+1], Y[r+1], base_height};
            writeTriangle(stl_file, v0, v2, v1, total_triangles);
            writeTriangle(stl_file, v1, v2, v3, total_triangles);
        }
    }

    // 11. Finalize file header with absolute triangle count
    stl_file.seekp(80, std::ios::beg);
    stl_file.write(reinterpret_cast<const char*>(&total_triangles), sizeof(uint32_t));
    stl_file.close();
    
    GDALClose(dataset);
    std::cout << "Successfully generated " << total_triangles << " watertight facets." << std::endl;
    return 0;
}