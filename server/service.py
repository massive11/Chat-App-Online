import mongo as mgo
import json
import config as conf
import time

WS_POOL = {}

PUB_KEYS = {}


def updateRelation(uid, f_uid, label_ba, is_agree):
    try:
        mgo.updateRelationTmp(f_uid, uid, 1 if is_agree else -1)
        if is_agree:
            label_ab = mgo.getLabelInUserRelationTmp(f_uid, uid)
            mgo.updateRelation(uid, f_uid, label_ba)
            mgo.updateRelation(f_uid, uid, label_ab)
        return True
    except Exception as e:
        print("info updateRelation err:{} uid:{} f_uid:{} is_agree:{}".format(e, uid, f_uid, is_agree))
        return False


def changeLabel(uid, fid, label):
    try:
        x = mgo.delRelation(uid, fid)
        print("info delRelation :{}".format(x))
        x = mgo.updateRelation(uid, fid, label)
        print("info updateRelation :{}".format(x))
        return True
    except Exception as e:
        print("info updateRelation err:{} uid:{} f_uid:{}".format(e, uid, fid))
        return False


def delFriend(uid, del_uid):
    try:
        mgo.delRelation(uid, del_uid)
        mgo.delRelation(del_uid, uid)
        mgo.delRelationTmp(uid, del_uid)
        mgo.delRelationTmp(del_uid, uid)
        return True
    except Exception as e:
        print("info del relation err:{} uid:{} f_uid:{}".format(e, uid, del_uid))
        return False


def getFriends(uid):
    try:
        users = []
        rets = mgo.getRelationByUID(uid)
        for ret in rets:
            users.append({"uid": int(ret["uid"]), "label": ret["label"], "fids": ret["fids"]})
        return users
    except Exception as e:
        print("info getFriends err:{} uid:{}".format(e, uid))
        return None


def delpool(uid):
    global WS_POOL
    del WS_POOL[uid]
    return


def getFriendsInfo(uid):
    result = {}
    try:
        friends = getFriends(uid)
        print("ada", friends)
        for label in friends:
            tmp = {}
            for fid in label['fids']:
                info = mgo.getUserInfoByUId(fid)
                tmp[fid] = {'name': info['name'], 'avatar': info['avatar'],
                            "online": True if WS_POOL.get(fid, None) is not None else False}
            if len(tmp) > 0:
                result[label['label']] = tmp
        print(result)
        return result
    except Exception as e:
        print("err: getOnline people info err:{}".format(e))
        return None


def getAddFriendPosts(uid):
    result = {}
    try:
        rets = mgo.getRelationTmp(uid)
        if rets is None:
            print("getRelationTmp result:{}".format(rets))
        for ret in rets:
            u = mgo.getUserInfoByUId(ret['uid'])
            result[ret['uid']] = {'name': u['name'],
                                  "time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ret['t']))}

        return result
    except Exception as e:
        print("err: getOnline people info err:{}".format(e))
        return None


def sendMsg(uids, msg):
    uid = 0
    print("uids", uids)
    try:
        print(WS_POOL)
        for uid in uids:
            ws = WS_POOL.get(uid, None)
            if ws is not None:
                print("uid:{} msg:{}".format(uid, msg))
                ws.send(json.dumps(msg))
            else:
                print("info uid:{} is not online.".format(uid))
        return True
    except Exception as e:
        print("err sendMsg err:{} uid:{} msg:{}".format(e, uid, msg))
        return None


def getPubKeys():
    pKeys = []
    for k, v in PUB_KEYS.items():
        pKeys.append({"uid": k, "p_key": v})
    return pKeys
