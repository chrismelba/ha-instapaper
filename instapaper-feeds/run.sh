#!/usr/bin/with-contenv bashio

echo "Starting RSS to Instapaper Wrapper Service..."

# Ensure config directory for feeds-to-instapaper exists
mkdir -p /root/.config/feeds-to-instapaper

# HA add-on ingress port is exposed via bashio or environment
export INGRESS_PORT=$(bashio::addon.ingress_port)

cd /server
node index.js
