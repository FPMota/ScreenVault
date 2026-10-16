# ScreenVault

A private mobile diary for series: progress, ratings and reviews in one place.

## Run it on an iPhone

1. Install **Expo Go** from the App Store.
2. Connect the iPhone and this computer to the same Wi-Fi network.
3. In PowerShell, run:

   ```powershell
   cd C:\ScreenVault\mobile
   npm run start -- --lan
   ```

4. Scan the QR code with the Camera app, then open it in Expo Go.

Progress, ratings, reviews and the series list are stored locally on the iPhone. The personal export in `data/imports/series-progress.json` is ignored by Git and never ships with the website. In the app, open **Perfil → Importar lista privada**, then paste the complete contents of that file.

## Deploy on Vercel

Vercel is configured to build the `mobile` folder when this repository is deployed from its root. Push these changes to the linked repository and Vercel will publish the PWA automatically.

On the iPhone, open the deployed link in Safari, select **Partilhar** and choose **Adicionar ao ecrã principal**.
