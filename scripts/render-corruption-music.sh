#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Lower sample-rate interpretation changes speed and pitch together, without
# pitch-preserving time-stretch grains. SoX then resamples to standard 48 kHz.
# 46819 / 48000 ~= 0.9754; trim the sub-millisecond rounding to two minutes.
# One dB of headroom prevents codec/resampling overshoots from clipping.
ffmpeg -hide_banner -loglevel error -y \
  -i src/assets/music/no-escape.mp3 \
  -af 'asetrate=46819,aresample=48000:resampler=soxr:precision=28,apad,atrim=duration=120,volume=-1dB,afade=t=out:st=119.995:d=0.005' \
  -c:a aac -b:a 320k -movflags +faststart \
  src/assets/music/no-escape-slow.m4a
