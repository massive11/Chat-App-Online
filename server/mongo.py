import pymongo
import config as conf
import re


def getMongo():
    # c = pymongo.MongoClient(
    #     'mongodb://admin:admin@127.0.0.1:27017')
    # a = c[conf.DB_USER][conf.COL_USER_ID]
    # a.de()
    return pymongo.MongoClient(
        'mongodb://127.0.0.1:27017')


def getNextUID():
    username_id = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_ID]
    ret = username_id.find_and_modify({"_id": "name"}, {"$inc": {"id": 1}})
    return int(ret["id"])

# 添加用户
def addUser(name, password, avatar, ct):
    user_info = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_INFO]
    x = user_info.insert_one({"_id": getNextUID(), "name": name, "pwd": password, "ct": ct, "avatar": avatar})
    return x.inserted_id

# 通过昵称查找用户信息
def getUserInfoByName(name):
    user_info = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_INFO]
    user = user_info.find_one({"name": name})
    return user

# 通过昵称模糊查找用户
def getUserInfoByFuzzyName(name):
    user_info = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_INFO]
    users = user_info.find({"name": re.compile(name)})
    return users

# 通过ID查找用户
def getUserInfoByUId(uid):
    user_info = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_INFO]
    user = user_info.find_one({"_id": uid})
    return user


def userExists(name):
    user_info = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_INFO]
    return user_info.find({"name": name}).count()


def addUserRelationTmp(uid, f_uid, label, t):
    ur_tmp = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION_TMP]
    x = ur_tmp.update_one({"uid": uid, "f_uid": f_uid}, {"$set": {"label": label, "t": t, "status": 0}}, upsert=True)
    print(x)
    return x


def getLabelInUserRelationTmp(uid, f_uid):
    ur_tmp = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION_TMP]
    x = ur_tmp.find_one({"uid": uid, "f_uid": f_uid})
    if x is None:
        return None
    return x['label']


def updateRelationTmp(uid, f_uid, status):
    ur_tmp = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION_TMP]
    x = ur_tmp.update_one({"uid": uid, "f_uid": f_uid}, {"$set": {"status": status}})
    return x


# 获取
def getRelationTmp(uid):
    ur = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION_TMP]
    x = ur.find({"f_uid": uid, "status": 0})
    return x


def delRelationTmp(uid, f_uid):
    ur_tmp = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION_TMP]
    x = ur_tmp.delete_many({"uid": uid, "f_uid": f_uid})
    return x


def updateRelation(uid, f_uid, label):
    ur = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION]
    x = ur.update_one({"uid": uid, "label": label}, {"$addToSet": {"fids": {"$each": [f_uid]}}}, upsert=True)
    return x


def delRelation(uid, f_uid):
    ur = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION]
    x = ur.update_many({"uid": uid}, {"$pull": {"fids": f_uid}})
    return x


def getRelationByUID(uid):
    ur = conf.MONGO_CLIENT[conf.DB_USER][conf.COL_USER_RELATION]
    x = ur.find({"uid": uid})
    print(x.count())
    return x
