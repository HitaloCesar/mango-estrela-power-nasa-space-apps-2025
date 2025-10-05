#!/bin/bash

mkdir -p scripts
echo "const KEYS = { MAPBOX_KEY: '${MAPBOX_KEY}', GEMINI_KEY: '${GEMINI_KEY}' };" > scripts/keys.js
echo "Arquivo scripts/keys.js gerado com sucesso!"
