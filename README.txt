九宫格选图工具 - 可带走版本

1. 先在新电脑安装 Node.js
   建议安装 Node.js 18、20 或 22。

2. 把你的图片文件夹放进当前目录下的 img 文件夹
   结构示例:
   portable-collage-tool
   ├─ img
   │  ├─ 文件夹A
   │  ├─ 文件夹B
   │  └─ ...
   ├─ index.html
   ├─ server.js
   ├─ package.json
   └─ start.bat

3. 双击 start.bat
   如果个别电脑双击 start.bat 仍有问题，可以改用 start-npm.bat
   浏览器会自动打开 http://localhost:3000

4. 使用说明
   左侧选择文件夹
   右侧九宫格选图
   可切换 长宽适配 / 裁切填满
   点 保存选择 可记住当前文件夹的选图结果
   点 保存照片 会在当前图片文件夹中生成:
   当前文件夹名+合并.jpg

5. 记忆文件
   selection-state.json 会自动生成，用来保存每个文件夹上次的选择状态。

6. 关闭方式
   关闭运行 start.bat 后出现的黑色窗口即可停止服务。
