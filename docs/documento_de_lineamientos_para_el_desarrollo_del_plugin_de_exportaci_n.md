# Documento de Lineamientos y Especificaciones Técnicas

## Plugin de Obsidian: Exportación y Compresión Avanzada de Carpetas

### 1. Contexto y Propósito del Plugin

Este documento establece las directrices técnicas y funcionales para el desarrollo de un plugin personalizado de escritorio para **Obsidian**. El objetivo principal es permitir a los usuarios comprimir el contenido de carpetas seleccionadas en el explorador de archivos utilizando motores de compresión externos instalados en el sistema (como 7-Zip o WinRAR), ofreciendo opciones de guardado flexibles y un panel de configuración completo.

### 2. Requerimientos Funcionales

#### 2.1. Integración con el Menú Contextual
* Al hacer clic derecho sobre cualquier carpeta en el explorador de archivos de Obsidian (`file-menu`), debe aparecer la opción: **"Export folder to .ZIP"** (o adaptada según la extensión seleccionada en las preferencias).
* Al activar esta opción, el plugin debe capturar la ruta física absoluta de la carpeta seleccionada dentro del sistema de archivos del usuario.

#### 2.2. Uso de Motores de Compresión Externos (Binarios del Sistema)
* El plugin debe interactuar con ejecutables externos del sistema operativo (por ejemplo, `7z.exe`, `rar.exe`, etc.) utilizando los módulos nativos de Node.js (`child_process.spawn` **sin shell**, con array de argumentos — inmune a espacios y caracteres especiales en rutas).
* **Gestión de múltiples binarios:** El usuario debe poder registrar las rutas de uno o más ejecutables en la sección de ajustes del plugin (ej. tener configurado tanto 7-Zip como WinRAR). Debe existir autodetección de instalaciones comunes (Program Files) como ayuda para el alta rápida.
* **Dinámica de Formatos y Niveles (mapeo fijo por motor, sin query al binario):**
  * **7-Zip:** formatos `zip`, `7z`, `tar`, `gzip`, `bzip2`. Niveles: Almacenar (0), Rápido (3), Normal (5), Máximo (9). `tar.gz` se crea en dos pasadas (tar → gzip).
  * **WinRAR:** formatos `rar`, `zip`. Niveles 0–5 (Almacenar … Máximo).
  * La interfaz debe mostrar los formatos y niveles del motor activo/ seleccionado por el usuario.
* **Exclusiones fijas:** siempre se excluyen `.obsidian/*` y `.git/*` de la compresión (evita meter la configuración del vault si se exporta la raíz).

#### 2.3. Proceso de Compresión, Progreso y Diálogo Emergente (Modal)
* La compresión se realiza en una ruta temporal del sistema (`os.tmpdir()`), nunca dentro del vault.
* **Modal de progreso:** mientras comprime, se muestra un modal con barra de progreso y porcentaje (parseado del stdout del binario) y dos acciones:
  1. **Cancelar:** termina el proceso hijo (`kill`) y limpia el temporal.
  2. **Enviar a segundo plano:** el proceso sigue comprimiendo mientras el usuario usa Obsidian; un **status bar item** muestra el progreso (ej. `📦 Comprimiendo… 42%`) y al hacer click se reabre el modal de progreso.
* Al finalizar con éxito (en primer o segundo plano), se notifica (`Notice`) y se despliega un **modal de guardado** con dos opciones de acción:
  1. **Guardar junto a la carpeta:** mueve el archivo comprimido (rename; fallback copy+unlink si es otro volumen) al mismo directorio padre donde se encuentra la carpeta origen (es decir, al mismo nivel, **nunca** dentro de la carpeta que se acaba de comprimir). **Nunca pisa archivos:** si ya existe un archivo con el mismo nombre, se agrega un **sufijo con timestamp** (ej. `nombre-20261011-221530.zip`).
  2. **Descargar:** despliega el diálogo nativo de guardado del sistema operativo (`dialog.showSaveDialog` de Electron) para que el usuario seleccione manualmente el destino final. Fallback: abrir la carpeta de destino con `shell.showItemInFolder`.

#### 2.4. Sección de Configuración (`PluginSettingTab`)
La pestaña de ajustes del plugin debe contener obligatoriamente:
* **Administración de Binarios:** Una sección para agregar, editar y eliminar rutas de ejecutables externos de compresión, con autodetección de instalaciones comunes (7-Zip y WinRAR en Program Files) como atajo de alta.
* **Selección de Motor Activo:** Selector para definir qué binario se empleará por defecto.
* **Formato de Salida y Compresión:** Selectores adaptativos según el motor seleccionado (valores del mapeo fijo 2.2).

### 3. Requerimientos Técnicos y de Arquitectura (Para el Agente de Programación)

* **Entorno:** Obsidian Desktop App (plugin *desktop-only*, `isDesktopOnly: true` en manifest, por la dependencia de Node.js `child_process`).
* **Idioma de la UI:** Español. **Identificador interno:** `obsidian-export-folder-to-zip`.
* **APIs de Obsidian:**
  * Extender `Plugin` y registrar el evento en el menú contextual mediante `this.registerEvent(this.app.workspace.on('file-menu', ...))`, mostrando la opción solo para `TFolder`.
  * Extender `Modal` para el modal de progreso y el modal de guardado.
  * Extender `PluginSettingTab` para la gestión de las preferencias del usuario.
  * Ruta física de la carpeta: `app.vault.adapter` instanceof `FileSystemAdapter` → `getBasePath()` + path relativo de la `TFolder`.
* **Manejo de Procesos:** `spawn` sin shell (array de argumentos), control de `exit code`, captura de stderr para errores, `kill()` para cancelar, y limpieza del directorio temporal en todos los caminos (éxito, error, cancelación).
* **Estructura del proyecto (scaffold):**
  ```
  manifest.json
  versions.json
  esbuild.config.mjs
  tsconfig.json
  src/
    main.ts            # entrada, file-menu, orquestación
    engines.ts         # mapeo fijo 7z/WinRAR + builders de argumentos + autodetección
    compress.ts        # spawn + progreso + cancel + rename/copy con sufijo
    modal-progress.ts  # progreso / cancelar / segundo plano + status bar
    modal-save.ts      # guardar junto a la carpeta / descargar
    settings.ts        # PluginSettingTab
  ```
* **Build:** `node esbuild.config.mjs` (producción) sin errores de TypeScript.

### 4. Criterios de Aceptación (Definición de Terminado)

1. Aparece la opción "Exportar carpeta a…" en el menú contextual al hacer clic derecho en carpetas del explorador.
2. El sistema ejecuta el motor externo seleccionado (`spawn` sin shell) respetando rutas, formato y nivel configurados, excluyendo siempre `.obsidian/*` y `.git/*`.
3. Durante la compresión se muestra el modal de progreso con porcentaje; Cancelar termina el proceso y limpia el temporal; "Enviar a segundo plano" deja el status bar item con el progreso y permite reabrir el modal.
4. Al terminar, se abre el modal de guardado con las opciones "Guardar junto a la carpeta" y "Descargar".
5. "Guardar junto a la carpeta" ubica el archivo en el directorio padre correcto sin afectar el interior de la carpeta comprimida; si ya existe un archivo con el mismo nombre, agrega sufijo con timestamp (nunca pisa).
6. "Descargar" abre el diálogo nativo de guardado del SO (fallback: abrir carpeta destino).
7. La sección de configuración permite registrar múltiples binarios (con autodetección de Program Files) y adapta los formatos y niveles según el motor seleccionado.

---

### 5. Fuera de Alcance (Non-Goals)
- Compresión desde móvil (plugin desktop-only).
- Motores de compresión embebidos (solo binarios externos del sistema).
- Descompresión / apertura de archives.
- Programación de exports automáticos.