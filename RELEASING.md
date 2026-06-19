# Publicar una versión (Releases)

Databara se distribuye vía **GitHub Releases**. Los instaladores de macOS, Linux y Windows se
construyen automáticamente en GitHub Actions (`.github/workflows/release.yml`) cuando se empuja un tag
de versión. Tauri no permite cross-compilar, por eso cada SO se construye en su propio runner.

Los usuarios descargan desde: <https://github.com/ClaudioGuevaraDev/Databara/releases>

## Requisito único: generar el set de íconos

El bundle de macOS necesita `icon.icns` y el de Linux necesita PNGs; hoy el repo solo trae
`icon.ico`. **Antes del primer release** hay que generar el set completo una sola vez:

1. Coloca una imagen fuente cuadrada de alta resolución (idealmente **1024×1024 PNG**, fondo
   transparente) en `src-tauri/icons/source.png`.
2. Genera todos los formatos:
   ```bash
   pnpm tauri icon src-tauri/icons/source.png
   ```
   Esto crea en `src-tauri/icons/`: `icon.icns`, `icon.ico`, `32x32.png`, `128x128.png`,
   `128x128@2x.png`, `icon.png` y los recursos de Windows Store.
3. Actualiza `bundle.icon` en `src-tauri/tauri.conf.json` para referenciar el set completo:
   ```json
   "icon": [
     "icons/32x32.png",
     "icons/128x128.png",
     "icons/128x128@2x.png",
     "icons/icon.icns",
     "icons/icon.ico"
   ]
   ```
4. Commitea los íconos generados y el cambio de config.

## Flujo de release

1. **Sube la versión** en los tres manifiestos (deben quedar sincronizados):
   - `package.json` → `version`
   - `src-tauri/Cargo.toml` → `version`
   - `src-tauri/tauri.conf.json` → `version`
   - El skill `/conventional-commit` hace este bump automáticamente.
2. **Commit y push** a `main`.
3. **Crea y empuja el tag** con el prefijo `v`:
   ```bash
   git tag v0.10.1
   git push origin v0.10.1
   ```
4. GitHub Actions construye los 3 SO y crea un **Release en borrador** con todos los instaladores.
   Sigue el progreso en la pestaña **Actions** del repo.
5. Cuando termine, ve a **Releases**, revisa el borrador, agrega notas de la versión y **publica**.

### Artefactos generados

| SO      | Archivos                                                  |
| ------- | --------------------------------------------------------- |
| Windows | `.msi` (WiX), `-setup.exe` (NSIS)                         |
| macOS   | `.dmg` / `.app` (binario universal Intel + Apple Silicon) |
| Linux   | `.deb`, `.rpm`, `.AppImage`                               |

## Sin firma de código

Los instaladores se publican **sin firmar** (no configurado por ahora):

- **macOS**: al abrir aparece la advertencia de Gatekeeper. El usuario abre con **clic derecho →
  Abrir**, o ejecuta `xattr -dr com.apple.quarantine /Applications/Databara.app`.
- **Windows**: SmartScreen muestra un aviso → **Más información → Ejecutar de todos modos**.
- **Linux**: no se firma; es el comportamiento normal.

Para firmar más adelante (opcional, de pago):

- **macOS**: Apple Developer Program (99 USD/año) + notarización. Descomenta las variables `APPLE_*`
  en el workflow y agrégalas como _secrets_ del repo.
- **Windows**: certificado de code signing (OV ~100-300 USD/año con token, o Azure Trusted Signing
  ~10 USD/mes). Descomenta las variables `TAURI_SIGNING_*`.

## Build local (opcional)

Para probar el instalador de tu propio SO sin pasar por CI:

```bash
pnpm tauri build            # instaladores del SO actual
pnpm tauri build --no-bundle # solo el binario, sin empaquetar
```
