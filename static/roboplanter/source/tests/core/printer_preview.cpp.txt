// Offline fixture: encode a UTF-8 file using the exact firmware receipt path.
// Usage: printer_preview.exe text.txt receipt.bin [cut]
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include "../../firmware/xiao/include/printer_receipt.h"

int main(int argc, char** argv) {
  if (argc != 3 && argc != 4) return 2;
  std::ifstream input(argv[1], std::ios::binary);
  if (!input) return 2;
  const std::string text((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
  const bool cut = argc == 4 && std::string(argv[3]) == "cut";
  if (!robo::plannedReceiptBytes(text, cut)) return 3;
  std::ofstream output(argv[2], std::ios::binary);
  if (!output) return 2;
  const bool ok = robo::writeReceipt(text, [&](uint8_t byte) {
    output.put(static_cast<char>(byte)); return output.good();
  }, cut);
  output.flush();
  if (!ok || !output.good()) return 4;
  std::cout << "Wrote " << robo::plannedReceiptBytes(text, cut) << " bytes\n";
  return 0;
}
