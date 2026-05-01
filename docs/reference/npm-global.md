# 解决npm 安装中的 EACCESS问题

在linux中npm 安装 electron的时候出现了

```
EACCESS
```

权限错误， 解决方案如下

1. 创建 `~/.npm-global` 文件

2. 执行命令 `npm config set prefix '~/.npm-global'`

3. 创建或修改 `~/.profile` 文件, 写入下列内容：

```
export PATH=~/.npm-global/bin:$PATH
```

4. 执行命令 `source ~/.profile`

5. 执行npm 继续安装 `npm i -g electron`
