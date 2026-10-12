# Export Folder to ZIP — Plugin de Obsidian

Plugin de **escritorio** que comprime carpetas del vault con motores externos del sistema (**7-Zip** o **WinRAR**), con progreso, cancelación, segundo plano y guardado flexible.

> Desktop-only: usa `child_process` para ejecutar los binarios del sistema.

## Características

- **Menú contextual:** clic derecho sobre una carpeta → **"Exportar carpeta a…"**.
- **Motores externos:** 7-Zip (`zip`, `7z`, `tar`, `tar.gz`) o WinRAR (`rar`, `zip`), con niveles de compresión adaptados a cada motor.
- **Exclusiones fijas:** `.obsidian/*` y `.git/*` nunca entran al archivo.
- **Modal de progreso:** porcentaje en tiempo real con **Cancelar** (mata el proceso y limpia el temporal) y **Enviar a segundo plano** (status bar con el progreso; click para reabrir).
- **Guardado flexible:** al terminar, **"Guardar junto a la carpeta"** (al mismo nivel, nunca dentro; con sufijo timestamp si ya existe — nunca pisa) o **"Descargar"** (diálago nativo de guardado del SO).
- **Settings:** alta/edición/borrado de binarios, autodetección de instalaciones comunes (Program Files), motor activo, formato y nivel adaptativos.

## Instalación

1. Crear `.obsidian/plugins/obsidian-export-folder-to-zip/` dentro de tu vault.
2. Copiar ahí `manifest.json` y `main.js` (vienen compilados en el repo).
3. Reiniciar Obsidian → **Settings → Community plugins** → habilitar **Export Folder to ZIP**.
4. Ir a **Settings → Export Folder to ZIP** → **"Detectar instalados"** (o agregar el binario a mano) y elegir motor activo, formato y nivel.

## Desarrollo

Requiere [Node.js](https://nodejs.org/) 18+.

```bash
npm install        # dependencias
npm run build      # typecheck + bundle de producción → main.js
npm run dev        # watch mode
```

### Estructura

```
manifest.json
versions.json
esbuild.config.mjs
tsconfig.json
src/
  main.ts            # entrada: file-menu + orquestación de jobs
  engines.ts         # mapeo fijo 7-Zip/WinRAR + args + autodetección
  compress.ts        # spawn sin shell + progreso + cancel + move con sufijo
  modal-progress.ts  # progreso / cancelar / segundo plano + status bar
  modal-save.ts      # guardar junto a la carpeta / descargar
  settings.ts        # PluginSettingTab
docs/
  documento_de_lineamientos_para_el_desarrollo_del_plugin_de_exportación.md
```

## Fuera de alcance

- Uso en móvil (desktop-only).
- Motores embebidos (solo binarios externos).
- Descompresión de archives.
- Exports automáticos programados.

## Licencia

MIT
