// 把 mixin 方法面合并进 AppleStyleView 类类型（接口与类同名合并），让 input.js 类方法内的 this.xxx 能解析到 mixin 方法。
// 运行时仍由 input.js 末尾的 Object.assign(AppleStyleView.prototype, ...) 挂载；本文件只含类型。
import type { ViewMixinsLike } from './view-mixins';

declare module '../input.js' {
  // eslint 不接受空接口继承，这里用 type 别名的方式无法合并类，故保留一个真实成员：
  interface AppleStyleView extends ViewMixinsLike {
    /** 由 mixin 挂载的方法面已并入；此处占位成员标记合并来源 */
    readonly __viewMixinsMerged?: true;
  }
}
