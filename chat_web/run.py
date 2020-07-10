from flask import Flask, render_template, request, make_response, redirect, url_for, session
import random
import json
from datetime import timedelta
import requests

app = Flask(__name__, template_folder='./templates', static_url_path='', static_folder='./static')
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = timedelta(seconds=1)
app.config['SECRET_KEY'] = "debug_chat_room"
domain = 'http://127.0.0.1:9008'


@app.route('/chat')
def index():
    user = session.get('user', '')
    uid = session.get('uid', 0)
    avatar = session.get('avatar', '/img/dog.png')
    if user == '' or uid == 0:
        return redirect(url_for('.login'))
    name = user
    username = user

    return render_template('index.html', **locals())


@app.route('/', methods=['GET', 'POST'])
def login():
    # if request.method == 'POST':
    name = request.form.get('name')
    pwd = request.form.get('password')
    if name is not None:
        header_dict = {"Content-Type": "application/json; charset=utf8"}
        url = domain + "/user/login"
        resp = requests.post(url, headers=header_dict, data=json.dumps({"name": name, "password": pwd}))
        result = resp.json()
        if result['ret'] == 1:
            if result['data'] is not None and len(result['data']) > 0:
                print(result)
                session['user'] = name
                session['uid'] = result["data"]["uid"]
                session['avatar'] = result["data"]["avatar"]
                return redirect(url_for('index'))
        else:
            err_msg = "{}".format(result['msg'])
            return render_template("error.html", **locals())
    else:
        print(request.method)
        return render_template('login.html', **locals())


@app.route('/register', methods=['GET', 'POST'])
def register():
    # if request.method == 'POST':
    name = request.form.get('name')
    pwd = request.form.get('password')
    repwd = request.form.get('re_password')
    # if repwd != pwd:
    #     err_msg = "{}".format("密码不一致")
    #     return render_template("error.html", **locals())
    if name is not None:
        avatars = ['/img/dog.png', '/img/louis-ck.jpeg', '/img/michael-jordan.jpg', '/img/bo-jackson.jpg']
        avatar = random.choice(avatars)
        header_dict = {"Content-Type": "application/json; charset=utf8"}
        url = domain + "/user/register"
        # json.dumps将字典形式的数据转化为字符串
        resp = requests.post(url, headers=header_dict,
                             data=json.dumps({"name": name, "password": pwd, "avatar": avatar}))
        result = resp.json()
        if result['ret'] == 1:
            if result['data'] is not None and len(result['data']) > 0:
                print(result)
                uid = result["data"]["uid"]
                return redirect(url_for('login'))
        else:
            err_msg = "{}".format(result)
            return render_template("error.html", **locals())
    else:
        print(request.method)
        return render_template('register.html', **locals())


@app.route('/error')
def error():
    return render_template("404.html", **locals())


@app.route('/<username>')
@app.route('/chat/<username>')
def chat_user(username):
    avatars = ['/img/dog.png', '/img/louis-ck.jpeg', '/img/michael-jordan.jpg', '/img/bo-jackson.jpg']
    avatar = random.choice(avatars)
    username, name = username, username
    return render_template('index.html', **locals())


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)  # threaded=True,
