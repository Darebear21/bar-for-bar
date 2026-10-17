# Wraps bar-for-bar.html in a full HTML document: the icon links move into <head>, the app goes in <body>.
body = open('bar-for-bar.html').read()
links = open('icon/links.html').read()
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Bar for Bar: freestyle rap battle trainer with a bouncing beat ball and rhyme prompts.">
<style>html,body{margin:0}[hidden]{display:none!important}</style>
'''
open('index.html', 'w').write(head + links.strip('\n') + '\n</head>\n<body>\n' + body.replace(links, '') + '\n</body>\n</html>\n')
