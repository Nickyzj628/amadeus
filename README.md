# amadeus

男生自用全新QQ群聊机器人，基于[LLBot](https://luckylillia.com/)/[SnowLuma](https://snowluma.github.io/)

### 安装LLBot

出门左转[LLBot快速安装](https://luckylillia.com/guide/choice_install)

使用LLBot登录机器人QQ后，在Bot配置栏目下启用OneBot 11，及其HTTP和HTTP POST服务，随意填写它们的端口号并记好

### 配置环境变量、模型、MCP、...

将dist目录下的`config.example.json`改名为`config.json`后填写配置

建议用VSCode等IDE打开配置文件，鼠标移到字段名上可以看到类型提示

### 运行:

`./run.bat`

### LLBot连不上的备用方案（SnowLuma）

出门右转[SnowLuma Windows手动部署](https://snowluma.github.io/guide/deploy/windows.html)

在[控制台](http://127.0.0.1:3080/config)里配置OneBot协议端的HTTP和HTTP POST服务

还是在[控制台](http://127.0.0.1:3080/processes)里给已登录的QQ客户端注入SnowLuma
