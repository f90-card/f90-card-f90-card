#!/usr/bin/env bash
set -euo pipefail
node --check app.js
node --check admin.js
node --check f90-media-player.js
grep -q 'staff.radio.preview' supabase/functions/f90-platform/index.ts
grep -q 'selected_index' supabase/functions/f90-platform/index.ts
grep -q 'music_audio_files' admin.js
grep -q 'f90ScrollY' app.js
grep -q 'F90MediaPlayer' f90-media-player.js
echo 'F90 media and navigation scripts pass syntax checks'
