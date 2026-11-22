#!/usr/bin/env bash
# Prépare le projet Android généré par Capacitor : icônes et écran de démarrage Dash4, permissions
# (appareil photo pour les photos et le scan, position pour les rapports), numéro de version, signature.
set -euo pipefail
cd "$(dirname "$0")/.."

RES=android/app/src/main/res
IM=$(command -v magick || command -v convert)

# Icônes : chaque icône du modèle remplacée par celle de Dash4, à la même taille
rm -rf "$RES/mipmap-anydpi-v26"
find "$RES" -path '*mipmap-*' -name 'ic_launcher*.png' | while read -r f; do
  size=$("$IM" identify -format '%wx%h' "$f")
  "$IM" resources/icon.png -resize "${size}!" "$f"
done
# Écran de démarrage
find "$RES" -path '*drawable*' -name 'splash.png' | while read -r f; do
  size=$("$IM" identify -format '%wx%h' "$f")
  "$IM" resources/splash.png -resize "${size}^" -gravity center -extent "$size" "$f"
done

# Permissions
MANIFEST=android/app/src/main/AndroidManifest.xml
for perm in CAMERA ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION; do
  grep -q "android.permission.$perm" "$MANIFEST" || sed -i "s#</manifest>#    <uses-permission android:name=\"android.permission.$perm\" />\n</manifest>#" "$MANIFEST"
done
grep -q 'android.hardware.camera' "$MANIFEST" || sed -i 's#</manifest>#    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>#' "$MANIFEST"

# Version : 0.1.<numéro de build> (le numéro de build augmente à chaque compilation)
BUILD=${BUILD_NUMBER:-1}
BASE=$(node -p "require('./package.json').version.split('.').slice(0, 2).join('.')")
GRADLE=android/app/build.gradle
sed -i -E "s/versionCode [0-9]+/versionCode $BUILD/; s/versionName \"[^\"]*\"/versionName \"$BASE.$BUILD\"/" "$GRADLE"
echo "VERSION_NAME=$BASE.$BUILD" >> "${GITHUB_ENV:-/dev/null}"

# Signature de la version définitive, si la clé est fournie (secrets du dépôt)
if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > android/app/release.keystore
  cat >> "$GRADLE" <<'GRADLE'

android {
    signingConfigs {
        dash4 {
            storeFile file('release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD') ?: System.getenv('ANDROID_KEYSTORE_PASSWORD')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.dash4
        }
    }
}
GRADLE
  echo "SIGNED=1" >> "${GITHUB_ENV:-/dev/null}"
fi
echo "Projet Android prêt (version $BASE.$BUILD)."
