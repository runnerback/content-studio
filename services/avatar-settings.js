// services/avatar-settings.js
//
// 图片水印头像：从本机选一张 ≤100KB 的图片读成 data URL（存 settings.avatarBase64）。
// 3.12.0 起水印设置从插件设置页挪到预览悬浮层「高级选项」，这里只放与 UI 无关的选图逻辑。

export const AVATAR_MAX_BYTES = 100 * 1024;

/**
 * 弹系统文件选择框选头像；用户取消时 resolve('')；超过大小限制 reject。
 * @param {Document} activeDocument
 * @returns {Promise<string>} data URL，或用户未选择时的空串
 */
export function pickLocalAvatarDataUrl(activeDocument) {
  return new Promise((resolve, reject) => {
    const input = activeDocument.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (!file) {
        resolve('');
        return;
      }
      if (file.size > AVATAR_MAX_BYTES) {
        reject(new Error(`图片太大（${Math.round(file.size / 1024)} 千字节），请选择 ${AVATAR_MAX_BYTES / 1024} 千字节以内的图片`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error || new Error('读取头像文件失败'));
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
