import re
import os

INPUT_FILE = "frame.txt"
OUTPUT_FILE = "frame.bin"
FRAME_SIZE = 1024  # 128 * 64 / 8

# Baca semua baris frame.txt
with open(INPUT_FILE, "r", encoding="utf-8") as f:
    text = f.read()

# Pisahkan berdasarkan tanda frame
frames = re.split(r"//\s*'frame.*?'\s*,?\s*\d+x\d+px", text, flags=re.MULTILINE)
frames = [f.strip() for f in frames if f.strip()]

print(f"📄 Ditemukan {len(frames)} frame dalam file teks")

with open(OUTPUT_FILE, "wb") as out:
    for i, frame in enumerate(frames):
        # Ambil semua nilai hex (contoh: 0x1F, 0X00, 0xAB, dst.)
        hex_values = re.findall(r"0x[0-9A-Fa-f]{2}", frame)
        bytes_frame = bytes([int(h, 16) for h in hex_values])

        # Pastikan panjang tiap frame = 1024 byte (padding nol kalau kurang)
        if len(bytes_frame) < FRAME_SIZE:
            bytes_frame += bytes([0]) * (FRAME_SIZE - len(bytes_frame))
        elif len(bytes_frame) > FRAME_SIZE:
            print(f"⚠️ Frame {i+1} oversize ({len(bytes_frame)} byte), dipotong.")
            bytes_frame = bytes_frame[:FRAME_SIZE]

        out.write(bytes_frame)
        print(f"✅ Frame {i+1:02d} ({len(bytes_frame)} byte) ditulis")

print(f"🎉 Semua frame selesai! Output disimpan ke '{OUTPUT_FILE}'")
