import config as conf
import mongo
import time
from flask import Flask
import json
from api import user, file
from flask_sockets import Sockets
from service import WS_POOL, PUB_KEYS, sendMsg, delpool, getFriendsInfo, getPubKeys, getAddFriendPosts

app = Flask(__name__, static_folder="./static")

sockets = Sockets(app)


@sockets.route('/echo')
def echo_socket(ws):
    r_data = ws.receive()
    r_data = json.loads(r_data)
    print(r_data)
    if not r_data['type'] == 'open':
        print(r_data['type'])
        return
    # 用户登录的个人信息
    username = r_data['data']['user']
    name = r_data['data']['name']
    uid = int(r_data['data']['uid'])
    avatar = r_data['data']['avatar']
    pub_key = r_data['data']['pub_key']
    PUB_KEYS[uid] = pub_key
    getFriendsInfo(uid)
    try:
        WS_POOL[uid] = ws
        print('{}进来了，当前在线人数：{}'.format(name, len(WS_POOL)))
        # 公钥
        people = getAddFriendPosts(uid)
        if len(people) > 0:
            sendMsg([uid], {'type': 'add_friend',
                            'data': {
                                'people': people
                            }})
        else:
            sendMsg([uid], {'type': 'init',
                        'data': {
                            'people': getFriendsInfo(uid),
                            'time': time.strftime('%H:%M:%S', time.localtime()),
                            'pub_keys': getPubKeys(),
                            'people_num': len(WS_POOL)}})

        us = []
        for k, v in WS_POOL.items():
            print(k)
            if k != uid:
                print("a", k)
                us.append(k)

        sendMsg(us,
                {'type': 'enter',
                 'data': {'name': name,
                          'avatar': avatar,
                          'uid': uid,
                          'user': username,
                          'people_num': len(WS_POOL),
                          'time': time.strftime('%H:%M:%S', time.localtime()),
                          'pub_key': PUB_KEYS[uid]}})

    except Exception as e:
        print("asdasd:{}".format(e))

    while not ws.closed:
        r_data = ws.receive()
        if not r_data:
            break

        r_data = json.loads(r_data)
        print('r_data', r_data)
        if r_data['type'] == 'say':
            data = r_data['data']
            try:
                sendMsg([k for k, v in WS_POOL.items() if k != uid],
                        {'type': 'say',
                         'data': {'name': name,
                                  'content': data['content'],
                                  'avatar': avatar,
                                  'time': time.strftime('%H:%M:%S', time.localtime()),
                                  }})
            except Exception as e:
                print(e)
        elif r_data['type'] == 'private':
            try:
                sendMsg([int(r_data['data']['to'])],
                        {'type': 'private',
                         'data': {'from': name,
                                  'fromName': username,
                                  'fromUid': uid,
                                  'content': r_data['data']['content'],
                                  'avatar': avatar,
                                  'user': r_data['data']['to'],
                                  'time': time.strftime('%H:%M:%S', time.localtime()),
                                  'key': r_data['data']['key'],
                                  }})
            except Exception as e:
                print(e)
        # elif r_data['type'] == 'file':
        #     try:
        #         sendMsg([int(r_data['data']['to'])],
        #                 {'type': 'file',
        #                  'data': {'from': name,
        #                           'fromName': username,
        #                           'fromUid': uid,
        #                           'file_data': r_data['data']['file_data'],
        #                           'file_name': r_data['data']['file_name'],
        #                           'avatar': avatar,
        #                           'user': r_data['data']['to'],
        #                           'key': r_data['data']['key'],
        #                           'done': r_data['data']['done'],
        #                           'time': time.strftime('%H:%M:%S', time.localtime())
        #                           }})
        #     except Exception as e:
        #         print(e)

    # 用户离开
    delpool(uid)
    sendMsg([k for k, v in WS_POOL.items()],
            {'type': 'leave',
             'data': {'name': name,
                      'user': username,
                      'uid': uid,
                      'people_num': len(WS_POOL),
                      'time': time.strftime('%H:%M:%S', time.localtime())}})
    print('{}离开了，当前在线人数：{}'.format(name, len(WS_POOL)))


if __name__ == '__main__':
    conf.MONGO_CLIENT = mongo.getMongo()
    from gevent import pywsgi
    from geventwebsocket.handler import WebSocketHandler

    user.init_api_user(app)
    file.init_api_user(app)

    server = pywsgi.WSGIServer(('0.0.0.0', 9008), app, handler_class=WebSocketHandler)
    print('web server start ... ')
    server.serve_forever()
