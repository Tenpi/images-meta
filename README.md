Image Meta
========

支持将一些元数据写入图片中，并读取出来。用法参见 `test/`。

# 特性
- 支持读取 JPG 的 Exif
- 支持读取 PNG 的 chunk 文本
- 支持将元数据写入图片中
- 支持传入本地图片，或者图片数据（DataUrl / Base64 / Binary String / Buffer）
- 支持 Node.js / 浏览器

# 注意
- 图片经过压缩后，元数据会丢失
- 图片上传至 JFS，元数据仍然会保留

# 下载
JNPM 项目地址：http://npm.m.jd.com/package/@o2team/images-meta
   
```bash
npm install @o2team/images-meta --registry=http://registry.m.jd.com
```

# 作者

- 朱奕腾 [zhuyiteng@jd.com](mailto:zhuyiteng@jd.com)
