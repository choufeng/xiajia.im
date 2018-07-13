# 使用FRP创建内网穿透服务

使用内网穿透是调试微信开发的最好方案

## 什么是FRP

FRP 是一个内网穿透方案

地址： [FRP](https://github.com/fatedier/frp)

## 创建内网web服务

1. 在服务器下载项目最新[release](https://github.com/fatedier/frp/releases)版本
2. 配置frps.ini文件

```
[common]
bind_port = 7000
vhost_http_port = 80
```
3. 运行服务  ./frps -c frps.ini

4. 在本地下载项目代码
5. 配置frpc.ini

```
[common]
server_addr = xx.xx.xx.xx // 你的服务器地址
server_port = 7000

[web]
type = http
local_ip = 127.0.0.1
local_port = 3000
custom_domains = xxx.com // 你的域名

```

6. 把域名做A到xx.xx.xx.xx

