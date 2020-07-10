import os
from flask import request, Blueprint, make_response, jsonify
from service import sendMsg
import time
import resp

apiFile = Blueprint('file', __name__)
imgsExtension = ["jpg", "gif", "png", "jpeg", "JPG", "GIF", "PNG", "JPEG"]


def init_api_user(app):
    app.register_blueprint(blueprint=apiFile, url_prefix='/file/')


@apiFile.route('/send_file', methods=['post'])
def uploadAndSend():
    upload_path = './static'
    file = request.files['file']
    username = request.form.get("user")
    name = request.form.get("name")
    uid = request.form.get("to")
    avatar = request.form.get("avatar")
    if not file:
        return {"status": "fail"}
    filename = file.filename

    # 判断是否图片
    extension = filename.split('.')[-1]
    file_type = "img" if extension in imgsExtension else "other"
    print(file_type)
    # 图片地址
    url = "static/{}".format(filename)
    try:
        # 保存文件
        file.save(os.path.join(upload_path, filename))
        sendMsg([int(uid)],
                {'type': 'file',
                 'data': {'from': name,
                          'fromName': username,
                          'fromUid': uid,
                          'file_name': filename,
                          'avatar': avatar,
                          'user': uid,
                          'file_url': url,
                          'file_type': file_type,
                          'time': time.strftime('%H:%M:%S', time.localtime())
                          }})
    except Exception as e:
        print("send file err:{}".format(e))

    # 解决跨域问题
    rst = make_response(jsonify({"url": url, "file_type": file_type}))
    rst.headers['Access-Control-Allow-Origin'] = '*'
    return rst, 200
