const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../src/main/preload.js'),
      contextIsolation: true
    }
  });

  await win.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  setTimeout(async () => {
    const res = await win.webContents.executeJavaScript(`
      (() => {
        const vrm = window.appControllers?.avatarManager?.getActiveVRM();
        if (!vrm) return { error: 'no vrm' };
        const lLeg = vrm.humanoid.getNormalizedBoneNode('leftUpperLeg');
        const rLeg = vrm.humanoid.getNormalizedBoneNode('rightUpperLeg');
        const lFoot = vrm.humanoid.getNormalizedBoneNode('leftFoot');
        const rFoot = vrm.humanoid.getNormalizedBoneNode('rightFoot');

        // Test Negative Z for Left, Positive Z for Right (Spread Outward)
        lLeg.rotation.set(0, 0, -0.6);
        rLeg.rotation.set(0, 0, 0.6);
        lFoot.updateWorldMatrix(true, false);
        rFoot.updateWorldMatrix(true, false);

        return {
          leftFootX: +lFoot.matrixWorld.elements[12].toFixed(3),
          rightFootX: +rFoot.matrixWorld.elements[12].toFixed(3),
          spreadWidth: +(lFoot.matrixWorld.elements[12] - rFoot.matrixWorld.elements[12]).toFixed(3)
        };
      })()
    `);
    console.log('[VERIFICATION RESULT]:', JSON.stringify(res));
    app.quit();
  }, 3500);
});
