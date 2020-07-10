import mongo
import time
import resp
import service
from flask import request, Blueprint, make_response, jsonify
import json
from run import sendMsg
import hashlib

apiUser = Blueprint('apiUser', __name__)


def init_api_user(app):
    app.register_blueprint(blueprint=apiUser, url_prefix='/user/')


@apiUser.route('/register', methods=['POST'])
def register():
    try:
        data_source = request.get_data(as_text=True)
        data = json.loads(data_source)
    except Exception as e:
        print('err: param err:{}'.format(e))
        return resp.ReplyFail(resp.PARAM_ERR_CODE, resp.ParamErr)
    user_name = data['name']
    password = data['password']
    avatar = data['avatar']
    print("info: username:{} password:{}".format(user_name, password))

    # user已存在
    if mongo.userExists(user_name):
        print("err: code:{} msg:{} username:{}".format(resp.EXISTED_ERR_CODE, resp.ExistedErr, user_name))
        return resp.ReplyFail(resp.EXISTED_ERR_CODE, resp.ExistedErr)

    ct = int(round(time.time() * 1000))
    hl = hashlib.md5()
    hl.update(password.encode(encoding='utf-8'))
    uid = mongo.addUser(user_name, hl.hexdigest(), avatar, ct)
    if uid is not None:
        print("info: new user:{} id:{} ct:{}".format(user_name, uid, ct))
        return resp.ReplyOK({"uid": uid, "name": user_name})
    else:
        print("err: add user err code:{} msg:{} username:{}".format(resp.SRV_ERR_CODE, resp.SrvErrRet, user_name))
        return resp.ReplyFail(resp.SRV_ERR_CODE, resp.SrvErrRet)


@apiUser.route('/login', methods=['POST'])
def login():
    try:
        data_source = request.get_data(as_text=True)
        data = json.loads(data_source)
    except Exception as e:
        print('err: param err:{}'.format(e))
        return resp.ReplyFail(resp.PARAM_ERR_CODE, resp.ParamErr)
    user_name = data['name']
    password = data['password']
    print("info: username:{} password:{}".format(user_name, password))
    user_info = mongo.getUserInfoByName(name=user_name)
    if user_info is None:
        print("err: user is not exist code:{} username:{}".format(resp.NOT_EXISTED_ERR_CODE, resp.NotExistedErr,
                                                                  user_name))
        return resp.ReplyFail(resp.NOT_EXISTED_ERR_CODE, resp.NotExistedErr)
    hl = hashlib.md5()
    hl.update(password.encode(encoding='utf-8'))
    if user_info['pwd'] != hl.hexdigest():
        print("err: password err username:{} password:{} truePwd:{}".format(user_name, password, user_info['pwd']))
        return resp.ReplyFail(resp.PARAM_ERR_CODE, "密码错误")

    return resp.ReplyOK({"uid": user_info['_id'], "avatar": user_info['avatar']})


# req: uid or username
# resp: user info:{uid,username,status}
@apiUser.route('/find_user', methods=['POST'])
def findUser():
    uid = int(request.form.get("uid", "0"))
    s_uid = int(request.form.get("search_uid", "0"))
    s_name = request.form.get("search_name", "")
    if s_uid == 0 and s_name == '':
        print('err: param err: invalid uid and username')
        return resp.ReplyFail(resp.PARAM_ERR_CODE, resp.ParamErr)
    user_infos = {}
    if s_name != '':
        infos = mongo.getUserInfoByFuzzyName(name=s_name)
        if infos is None:
            print("info: user is not exist code:{} username:{}".format(resp.NOT_EXISTED_ERR_CODE, resp.NotExistedErr,
                                                                       s_name))
            # 解决跨域问题
            rst = make_response(jsonify({"not_exist": 0}))
            rst.headers['Access-Control-Allow-Origin'] = '*'
            return rst, 200
            # return resp.ReplyFail(resp.NOT_EXISTED_ERR_CODE, resp.NotExistedErr)
        for info in infos:
            print(info)
            user_infos[info["_id"]] = {"name": info["name"], "avatar": info["avatar"]}
    elif s_uid != 0:
        info = mongo.getUserInfoByUId(uid=s_uid)
        if info is None:
            print("info: user is not exist code:{} uid:{}".format(resp.NOT_EXISTED_ERR_CODE, resp.NotExistedErr,
                                                                  s_uid))
            rst = make_response(jsonify({"not_exist": 0}))
            rst.headers['Access-Control-Allow-Origin'] = '*'
            return rst, 200
            # return resp.ReplyFail(resp.NOT_EXISTED_ERR_CODE, resp.NotExistedErr)
        user_infos[info["_id"]] = {"name": info["name"], "avatar": info["avatar"]}
    users = {}
    for id, info in user_infos.items():
        label = mongo.getLabelInUserRelationTmp(uid, int(id))
        if label is not None:
            info['is_friend'] = True
            info['label'] = label
            info['online'] = True if service.WS_POOL.get(id, None) is not None else False
        else:
            # TODO
            info['is_friend'] = False
        users[id] = info
    print("info search: uid{} result:{}".format(uid, {"type": "search",
                                                      "data": users}))
    sendMsg([int(uid)], {"type": "search",
                         "data": users})
    rst = make_response(jsonify({"exist": 1}))
    rst.headers['Access-Control-Allow-Origin'] = '*'
    return rst, 200
    # return resp.ReplyOK({"uid": info["_id"], "name": info["name"], "status": USER_STATUS.get(info["_id"], 0)})


# req: {uid,f_uid,label}
# resp:
@apiUser.route('/add_friend', methods=['POST'])
def addFriend():
    try:
        uid = int(request.form.get('uid', '0'))
        f_uid = int(request.form.get('add_uid', '0'))
        label = request.form.get('label', '')
        # name = request.form.get('name', '')

        # 默认分组
        if label == "":
            label = "Default"
        # # people = {uid: {"name": name, "time": time.strftime('%H:%M:%S', time.localtime())}}
        # # ret = sendMsg([f_uid], {"type": "add_friend",
        # #                         "data": {"people":people}})
        # if ret is None:
        #     rst = make_response()
        #     rst.headers['Access-Control-Allow-Origin'] = '*'
        #     return rst, 403
        x = mongo.addUserRelationTmp(uid, f_uid, label=label, t=int(time.time()))
        if x is not None:
            rst = make_response()
            rst.headers['Access-Control-Allow-Origin'] = '*'
            return rst, 200
        else:
            print("err: add user relation tmp req:{}".format(request.form))
            rst = make_response()
            rst.headers['Access-Control-Allow-Origin'] = '*'
            return rst, 403
            # return resp.ReplyFail(resp.SRV_ERR_CODE, resp.SrvErrRet)
    except Exception as e:
        print("err: add user relation tmp err:{} req:{}".format(e, request.form))
        rst = make_response()
        rst.headers['Access-Control-Allow-Origin'] = '*'
        return rst, 403
        # return resp.ReplyFail(resp.SRV_ERR_CODE, resp.SrvErrRet)


@apiUser.route('/agree_add_fr', methods=['POST'])
def agreeAddFr():
    uid = int(request.form.get('uid', '0'))
    fid = int(request.form.get('fid', '0'))
    label = request.form.get('label', "Default")
    ok = request.form.get('is_agree', 'no')
    is_agree = True if ok == "yes" else False
    flag = service.updateRelation(uid, fid, label, is_agree)
    if not flag:
        rst = make_response()
        rst.headers['Access-Control-Allow-Origin'] = '*'
        return rst, 403
    info = mongo.getUserInfoByUId(uid)
    ret = sendMsg([fid], {"data": {"uid": uid, "agree": ok, "name": info['name']}, "type": "agree"})
    if ret is None:
        rst = make_response()
        rst.headers['Access-Control-Allow-Origin'] = '*'
        return rst, 403
    print("info: uid:{} f_uid:{} friend relation:{} ".format(uid, fid, is_agree))
    rst = make_response()
    rst.headers['Access-Control-Allow-Origin'] = '*'
    return rst, 200


@apiUser.route('/get_friends', methods=['POST'])
def getFriends():
    try:
        data_source = request.get_data(as_text=True)
        data = json.loads(data_source)
    except Exception as e:
        print('err: param err:{}'.format(e))
        return resp.ReplyFail(resp.PARAM_ERR_CODE, resp.ParamErr)
    uid = data['uid']
    friends = service.getFriends(uid)
    print("info uid:{} friends:{}".format(uid, friends))
    return resp.ReplyOK({'data': friends})


@apiUser.route('/change_label', methods=['POST'])
def changeLabel():
    uid = int(request.form.get("uid", "0"))
    fid = int(request.form.get("fid", "0"))
    label = request.form.get("label", "")
    service.changeLabel(uid, fid, label)
    sendMsg([uid], {'type': 'init',
                    'data': {
                        'people': service.getFriendsInfo(uid),
                        'pub_keys': service.getPubKeys(),
                        'time': time.strftime('%H:%M:%S', time.localtime()),
                        'people_num': len(service.WS_POOL)}})

    rst = make_response(jsonify({"done": 1}))
    rst.headers['Access-Control-Allow-Origin'] = '*'
    return rst, 200


@apiUser.route('/del_friend', methods=['POST'])
def delFriend():
    uid = int(request.form.get("uid", "0"))
    del_uid = int(request.form.get("del_uid", "0"))
    service.delFriend(uid, del_uid)
    sendMsg([uid], {'type': 'init',
                    'data': {
                        'people': service.getFriendsInfo(uid),
                        'pub_keys': service.getPubKeys(),
                        'time': time.strftime('%H:%M:%S', time.localtime()),
                        'people_num': len(service.WS_POOL)}})
    sendMsg([del_uid], {'type': 'init',
                        'data': {
                            'people': service.getFriendsInfo(del_uid),
                            'pub_keys': service.getPubKeys(),
                            'time': time.strftime('%H:%M:%S', time.localtime()),
                            'people_num': len(service.WS_POOL)}})
    rst = make_response(jsonify({"done": 1}))
    rst.headers['Access-Control-Allow-Origin'] = '*'
    return rst, 200


@apiUser.route('/init', methods=['POST'])
def initFirends():
    uid = int(request.form.get("uid", "0"))
    sendMsg([uid], {'type': 'init',
                    'data': {
                        'people': service.getFriendsInfo(uid),
                        'pub_keys': service.getPubKeys(),
                        'time': time.strftime('%H:%M:%S', time.localtime()),
                        'people_num': len(service.WS_POOL)}})

    rst = make_response(jsonify({"done": 1}))
    rst.headers['Access-Control-Allow-Origin'] = '*'
    return rst, 200
