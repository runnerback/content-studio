// 插件在桌面端 Electron 渲染进程里使用 Node 的 Buffer / require（浏览器插件桥接的本地 HTTP 服务、图片二进制处理）。
// 目录站与 CI 的扫描环境没有 @types/node，这两个标识符会成为 error type，进而整条调用链被判为 unsafe。
// 这里用「可合并」的声明补上本插件用到的最小面：本地装了 @types/node 时 interface / namespace 合并、var 类型一致，不冲突。
// 注意：@types/node ≥ 20 的 Buffer 是泛型接口，升级时要把下面的 Buffer 接口改成相同的类型参数。
// tsconfig.scan.json 用 "types": [] 让本地扫描同样不吃 @types/node。
export {};

declare global {
  namespace NodeJS {
    interface Require {
      (id: string): unknown;
    }
  }

  interface Buffer extends Uint8Array {
    toString(encoding?: string, start?: number, end?: number): string;
    subarray(start?: number, end?: number): Buffer;
    slice(start?: number, end?: number): Buffer;
    copy(target: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
    readUInt16BE(offset?: number): number;
    writeUInt16BE(value: number, offset?: number): number;
    readBigUInt64BE(offset?: number): bigint;
    writeBigUInt64BE(value: bigint, offset?: number): number;
  }

  interface BufferConstructor {
    from(value: string, encoding?: string): Buffer;
    from(value: ArrayBuffer | SharedArrayBuffer, byteOffset?: number, length?: number): Buffer;
    from(value: Uint8Array | ArrayLike<number>): Buffer;
    isBuffer(value: unknown): value is Buffer;
    alloc(size: number, fill?: string | number | Uint8Array, encoding?: string): Buffer;
    concat(list: readonly Uint8Array[], totalLength?: number): Buffer;
    byteLength(value: string | ArrayBuffer | Uint8Array, encoding?: string): number;
  }

  var Buffer: BufferConstructor;
  var require: NodeJS.Require;
}
