
## NotaryXpert Desktop

Run the Vite web app:

```bash
npm run dev
```

Run the Electron desktop app in development:

```bash
npm run electron:dev
```

Build the Windows desktop installer:

```bash
npm run dist:win
```

The generated installer is written to `release/`.

## Mantra MFS110

The desktop app talks to the locally installed Mantra RD Service on the client PC. Recommended Settings values:

- Transport Mode: `Plain HTTP Localhost Only` when using the Electron app on the same Windows machine as the scanner.
- RD HTTP URL: `http://127.0.0.1:11100`
- RD Secure URL: `https://127.0.0.1:11100`
- Capture Timeout: `15000`

Use Settings -> Configure Fingerprint Scanner -> Test Connection. A reachable service should report the RD URL and service status. If the status is `NOTREADY`, restart Mantra RD Service, unplug/replug the MFS110, and check that the device is active in the Mantra RD Service dashboard.

MFS110 L1 RD capture returns biometric data inside an encrypted PID block. RD PID XML cannot be converted into a printable original thumb image by the app. For a non-RD/private desktop printing workflow, ask Mantra for the exact package name: `MFS110 Windows Public SDK / Enrollment SDK / Web SDK client service that returns fingerprint bitmap image data such as BitmapData, Base64BMP, raw BMP, or ISO 19794-4 image data`.

Do not use the old MFS100 Web SDK/MFS100ClientService for MFS110 L1. With only the RD Service installed, scans save the RD PID/device details and show a warning so the operator can use Upload Thumb for the printed document.
