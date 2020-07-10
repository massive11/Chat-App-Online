from flask import jsonify

ParamErr = 'invalid param'
ExistedErr = 'item existed'
NotExistedErr = 'item not existed'
SrvErrRet = 'internal error'

OK_CODE = 1
PARAM_ERR_CODE = 2
SRV_ERR_CODE = 3
EXISTED_ERR_CODE = 4
NOT_EXISTED_ERR_CODE = 4


def ReplyFail(code, msg):
    response = jsonify({'ret': code, 'msg': msg})
    return response


def ReplyOKWithoutData():
    response = jsonify()
    return response


# data 为dict
def ReplyOK(data):
    response = jsonify({'ret': OK_CODE, 'data': data})
    return response
