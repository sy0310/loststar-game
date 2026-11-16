#!/bin/sh
set -eu
PROMO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 "$PROMO_DIR/render.py" "$@"
