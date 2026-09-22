# 小黄条 · 桌面待办（自用版）

Windows + 安卓实时联动的极简 todolist，类小黄条体验。基于 React + Vite + Supabase（免费），数据全部在你自己的 Supabase 项目里。

## 功能

- 回车快速记录，点文字即可编辑
- 置顶、拖拽排序、勾选完成
- 已完成任务按天归档（回顾 / 写周报用）
- 未配置云端时纯本地运行（localStorage），配置 Supabase 后多端实时同步（约 1 秒内）
- PWA：手机浏览器打开后「添加到主屏幕」，体验接近原生 App

## 第一步：开通免费 Supabase（约 5 分钟）

1. 打开 https://supabase.com ，用 GitHub 账号免费注册，新建一个项目（区域选 Singapore 较快）。
2. 进入项目 → 左侧 **SQL Editor**，粘贴执行下面这段建表语句：

```sql
create table todos (
  id text primary key,
  text text not null,
  done boolean default false,
  pinned boolean default false,
  position double precision default 0,
  created_at bigint,
  completed_at bigint
);
alter table todos enable row level security;
create policy "self-use" on todos for all using (true) with check (true);
alter publication supabase_realtime add table todos;
```

3. 左侧 **Project Settings → API**，复制：
   - `Project URL`（形如 https://xxxx.supabase.co）
   - `anon public` key

> 注意：anon key 拥有这张表的全部读写权限（自用场景可接受），不要把 key 公开分享。

## 第二步：填入密钥

打开应用 → 右上角 ⚙️ 设置 → 粘贴 URL 和 anon key → 连接。状态变为「云同步已连接」即成功。手机和电脑两端填同一组密钥即可实时联动。

## 第三步：部署（让手机随时能访问）

开发模式只能本机用，要让手机随时访问需把网页挂到免费托管（二选一）：

**方案 A：Cloudflare Pages（推荐，国内访问稳定）**
1. `npm run build` 生成 `dist/`
2. 注册 Cloudflare → Workers & Pages → 直接上传 `dist/` 文件夹
3. 得到 `https://xxx.pages.dev` 域名，手机电脑都访问它

**方案 B：GitHub Pages**
1. 把项目推到 GitHub 仓库
2. `npm run build`，把 `dist/` 内容推到 `gh-pages` 分支（或用 GitHub Actions 自动发布）

## 手机端（安卓）

浏览器打开部署后的网址 → 菜单 →「添加到主屏幕」。之后像普通 App 一样点开即用，首次填入一次密钥即可。

## 电脑端（Windows 桌面悬浮窗）

两种玩法：

1. **简单够用**：Edge / Chrome 打开网址 → 菜单 →「应用 → 安装此站点为应用」，再用微软官方免费工具 **PowerToys** 的 `Always on Top`（Win+Ctrl+T）把窗口置顶，拖到桌面角落，调窄窗口即为小黄条效果。
2. **更完美（嵌入壁纸层）**：后续可以用 Electron 或 Python 打包一个无边框半透明窗口加载同一网址，需要时再加。

## 本地开发

```bash
npm run dev      # 开发预览 http://localhost:3000
npm run build    # 生产构建 → dist/
```

## 备注

- Supabase 免费项目闲置约一周会暂停，登录控制台点一下「Restore」即可恢复（数据不丢）。
- 离线时新增的内容会先存本地，联网后自动补传到云端。
