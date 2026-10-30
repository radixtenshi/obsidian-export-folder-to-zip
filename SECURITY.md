# Security

The plugin launches the configured 7-Zip or WinRAR executable locally to create archives. Review the configured binary path before using it.

The optional 7-Zip download starts only after explicit user confirmation. The built-in download is pinned to a specific upstream revision and checked against its expected size and SHA-256 before it is stored inside the plugin directory. A custom download URL must use HTTPS and provide a SHA-256 checksum. A checksum confirms that the downloaded bytes match the configured value; it does not establish that a custom binary is trustworthy.

The plugin does not send vault contents or telemetry. Network requests occur only when the user explicitly initiates a binary download, to the pinned GitHub raw URL or the configured custom URL.

For security reports, contact the maintainer through the GitHub profile linked in `manifest.json`; avoid posting exploitable details in a public issue.
