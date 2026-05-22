#!/usr/bin/env python3
"""
Generate base product images (white background studio shots) for Manifest.
Run once before the 4h build window and commit the output to the repo.

Usage:
    pip install openai
    OPENAI_API_KEY=sk-... python3 generate-base-images.py

Output: sandbox/public/images/prod_00N-base.png (6 files, ~1024x1024px each)
"""

import os
import base64
import time
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Install the OpenAI SDK first: pip install openai")
    raise SystemExit(1)

API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    print("Set OPENAI_API_KEY environment variable first.")
    raise SystemExit(1)

client = OpenAI(api_key=API_KEY)

# Output directory relative to this script
SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR.parent / "sandbox" / "public" / "images"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PRODUCTS = [
    {
        "id": "prod_001",
        "name": "Ceramic Pour-Over Coffee Set",
        "prompt": (
            "Professional studio product photography of a handthrown ceramic pour-over coffee "
            "dripper and server set. Stoneware, matte glaze, earthy tone. "
            "Pure white background, soft even lighting, subtle shadow underneath. "
            "Clean, minimal, commercial quality. No text, no props."
        ),
    },
    {
        "id": "prod_002",
        "name": "Merino Wool Throw Blanket",
        "prompt": (
            "Professional studio product photography of a folded merino wool throw blanket. "
            "Neutral oatmeal/natural colour, fine weave texture visible. "
            "Pure white background, soft diffused lighting, subtle shadow. "
            "Clean, minimal, luxury textile commercial shot. No text, no props."
        ),
    },
    {
        "id": "prod_003",
        "name": "Bamboo Desk Organiser",
        "prompt": (
            "Professional studio product photography of a three-tier bamboo desk organiser "
            "with removable dividers. Natural light bamboo tone, clean joinery. "
            "Pure white background, soft even lighting, subtle shadow. "
            "Clean, minimal, commercial quality. No text, no props."
        ),
    },
    {
        "id": "prod_004",
        "name": "Copper Cocktail Shaker",
        "prompt": (
            "Professional studio product photography of a seamless spun copper cocktail shaker, "
            "tall cylindrical form, polished warm copper exterior. "
            "Pure white background, studio lighting showing the copper metallic sheen. "
            "Clean, minimal, barware commercial quality. No text, no props."
        ),
    },
    {
        "id": "prod_005",
        "name": "Linen Tote Bag",
        "prompt": (
            "Professional studio product photography of a linen tote bag, natural undyed linen, "
            "standing upright showing the front face, cotton handles, clean stitching. "
            "Pure white background, soft even lighting, subtle shadow. "
            "Clean, minimal, accessories commercial quality. No text, no props."
        ),
    },
    {
        "id": "prod_006",
        "name": "Brass Candlestick Trio",
        "prompt": (
            "Professional studio product photography of three solid brass candlestick holders, "
            "graduated heights (short, medium, tall), lathe-turned, warm golden brass tone. "
            "Arranged in a loose cluster. Pure white background, studio lighting showing the "
            "brass metallic quality. Clean, minimal, homeware commercial quality. No text, no candles."
        ),
    },
]


def generate_image(product: dict) -> bytes:
    print(f"  Generating: {product['name']} ...", end=" ", flush=True)
    response = client.images.generate(
        model="gpt-image-2",
        prompt=product["prompt"],
        size="1024x1024",
        quality="medium",
        n=1,
    )
    b64 = response.data[0].b64_json
    print("done")
    return base64.b64decode(b64)


def main():
    print(f"Generating {len(PRODUCTS)} base product images...")
    print(f"Output: {OUTPUT_DIR}\n")

    for product in PRODUCTS:
        output_path = OUTPUT_DIR / f"{product['id']}-base.png"

        if output_path.exists():
            print(f"  Skipping {product['id']}-base.png (already exists)")
            continue

        try:
            image_bytes = generate_image(product)
            output_path.write_bytes(image_bytes)
            print(f"  Saved: {output_path.name} ({len(image_bytes) // 1024}KB)")
        except Exception as e:
            print(f"  ERROR for {product['id']}: {e}")

        # Small delay to avoid rate limiting
        time.sleep(1)

    print("\nDone. Commit these files before starting the 4h build window:")
    for p in PRODUCTS:
        path = OUTPUT_DIR / f"{p['id']}-base.png"
        status = "✓" if path.exists() else "✗ MISSING"
        print(f"  {status}  sandbox/public/images/{p['id']}-base.png")


if __name__ == "__main__":
    main()
