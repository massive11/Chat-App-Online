// document.querySelector('.chat[data-chat=person2]').classList.add('active-chat');
// document.querySelector('.person[data-chat=person2]').classList.add('active');
let ws = null;
let RSA_KEY_PAIR = null
let AES_KEY = ""
let pubKeysMap = new Map()
let SplitStr = "++"
let AESMode = ''
let AESModeMap = new Map()
let USER_ID_MAP = new Map()
let preUrl = "http://127.0.0.1:9008/"
let onlineUserHtml = ""
let onlineChatHtml = ""
let FRIEND_IDS = []
let userLabelMap = new Map()

$(document).ready(function () {
    if (ws) {
        console.log("hhh")
        return;
    }

    ws = new WebSocket('ws://0.0.0.0:9008/echo');

    let name = $('#name').html();
    let avatar = $('#user_avatar').attr('src');
    let user = $('#username').val();
    let uid = $('#uid').val();

    RSA_KEY_PAIR = rsaUtil.genKeyPair();
    console.log("pub_key:")
    console.log(RSA_KEY_PAIR.publicKey)
    console.log("pri_key:")
    console.log(RSA_KEY_PAIR.privateKey)

    AESModeMap['modeA'] = "ECB"
    AESModeMap['modeB'] = "CBC"
    AESMode = "modeA"
    console.log("default aes mode: ", AESModeMap[AESMode])

    ws.onopen = function () {
        console.log('web socket 已连接');
        ws.send(JSON.stringify({
            'type': 'open',
            'data': {name: name, user: user, avatar: avatar, uid: uid, pub_key: RSA_KEY_PAIR.publicKey}
        }));
    }

    ws.onmessage = function (event) {
        let r_data = event.data; //接收到的数据
        //console.log(r_data)
        show_message(r_data);
    }

    ws.onclose = function () {
        console.log('连接已关闭...');
    }
})


function show_message(json_string) {
    let json = JSON.parse(json_string);
    let type = json.type;
    let data = json.data;
    let avatar = data.avatar ? data.avatar : '/img/dog.png';
    let html = '';
    if (type === 'agree') {
        if (data.agree === 'yes') {
            initFriendReq()
        } else {
            alert(data.name + "拒绝了您的好友请求")
        }
        return true
    } else if (type === 'add_friend') {
        friendsVerify(data)
        initFriendReq()
        return true
    } else if (type === 'file') {
        file_url = preUrl + data.file_url
        file_type = data.file_type
        if (file_type === "img") {
            html = '<div class="group_you">' +
                '<img src="' + avatar + '" alt="" class="avatar"/>' +
                '<div class="you_name">' + data.from + '</div>' +
                '<div class="bubble you_msg">' + '<img style="width: 100px" src="' + file_url + '">' + '</div>' +
                '</div>';
        } else {
            html = '<div class="group_you">' +
                '<img src="' + avatar + '" alt="" class="avatar"/>' +
                '<div class="you_name">' + data.from + '</div>' +
                '<div class="bubble you_msg">' +
                '<a href="' + file_url + '">' + data.file_name + '</a>' +
                '</div>' +
                '</div>';
        }

        let div = document.getElementById('content_form_' + data.from)
        div.innerHTML += html;
        div.scrollTop = div.scrollHeight;
        if (!$('#online [data-chat="p_' + data.from + '"]').hasClass('active')) {
            $('#online [data-chat="p_' + data.from + '"] .new_blink').show()
            $('#online [data-chat="p_' + data.from + '"] .pp_status').hide()
            let msg_length = parseInt($('#online [data-chat="p_' + data.from + '"]').attr('data-msg'))
            $('#online [data-chat="p_' + data.from + '"] .msg_length').html(msg_length + 1)
            $('#online [data-chat="p_' + data.from + '"]').attr('data-msg', msg_length + 1)
        }
        $('#online [data-chat="p_' + data.from + '"] .time').html(data.time.substring(0, 5))
        return true
    } else if (type === 'enter') {
        html = '<div class="conversation-start">' +
            '<span>' + data.time + '</span>' +
            '</div>';
        html += '<div class="welcome_msg">-- ' + data.name + ' 进入了聊天室！--</div>';
        peopleEnter(data)
    } else if (type === 'search') {
        showSearchResult(data)

        return true
    } else if (type === 'init') {
        let pKeys = data.pub_keys
        // 存储好友的的publicKey
        pKeys.forEach(function (k) {
            pubKeysMap[k.uid] = k.p_key
        })

        initFriends(data.people, data.time, data.people_num)
        // pushMsg(data.history)
        // } else if (type === 'history') {
        //     pushMsg(data.history)
    } else if (type === 'leave') {
        html = '<div class="leave_msg">' + data.name + ' 离开了聊天室！</div>';
        peopleLeave(data)
    } else if (type === 'say') {
        html = '<div class="group_you">' +
            '<img src="' + avatar + '" alt="" class="avatar"/>' +
            '<div class="you_name">' + data.name + '</div>' +
            '<div class="bubble you_msg">' + data.content +
            '</div>' +
            '</div>';
        $('#online [data-chat="chat_group"] .time').html(data.time.substring(0, 5))
        let msg_length = parseInt($('#online [data-chat="chat_group"]').attr('data-msg'))
        $('#online [data-chat="chat_group"] .msg_length').html(msg_length + 1)
        $('#online [data-chat="chat_group"]').attr('data-msg', msg_length + 1)
        if (!$('#online [data-chat="chat_group"]').hasClass('active')) {
            $('#online [data-chat="chat_group"] .new_blink').show()
            $('#online [data-chat="chat_group"] .pp_status').hide()
        }
    } else if (type === 'private') {
        let cipherContent = data.content
        let key = data.key
        console.log("对称加密的密钥和加密模式的密文：\n" + key)
        let decryptedCon = rsaUtil.decrypt(key, RSA_KEY_PAIR.privateKey)
        let c1Arr = decryptedCon.split(SplitStr)
        let decryptedKey = c1Arr[0]
        let mode = c1Arr[1]
        console.log("对称加密的密钥和加密模式解密得到：\n对称加密的密钥:" + decryptedKey + " 加密模式: " + AESModeMap[mode])

        // 消息内容解密
        console.log("解密：")
        console.log("消息内容密文： \n" + cipherContent)
        let content = aesUtil.decrypt(cipherContent, decryptedKey, mode)
        let c2Arr = content.split(SplitStr)
        let msgSign = c2Arr[0]
        let msg = c2Arr[1]
        console.log("解密得到：\nsign:" + msgSign + "\n消息内容: " + msg)

        // 验证签名
        console.log("验证签名：")
        let md5Content = md5(msg)
        console.log(USER_ID_MAP[data.from])
        let flag = rsaUtil.myVerify(md5Content, msgSign, pubKeysMap[data.fromUid])
        console.log("验证结果", flag)
        if (!flag) {
            alert("消息被篡改！")
        }

        html = '<div class="group_you">' +
            '<img src="' + avatar + '" alt="" class="avatar"/>' +
            '<div class="you_name">' + data.from + '</div>' +
            '<div class="bubble you_msg">' + msg +
            '</div>' +
            '</div>';
        let div = document.getElementById('content_form_' + data.from)
        div.innerHTML += html;
        div.scrollTop = div.scrollHeight;
        if (!$('#online [data-chat="p_' + data.from + '"]').hasClass('active')) {
            $('#online [data-chat="p_' + data.from + '"] .new_blink').show()
            $('#online [data-chat="p_' + data.from + '"] .pp_status').hide()
            let msg_length = parseInt($('#online [data-chat="p_' + data.from + '"]').attr('data-msg'))
            $('#online [data-chat="p_' + data.from + '"] .msg_length').html(msg_length + 1)
            $('#online [data-chat="p_' + data.from + '"]').attr('data-msg', msg_length + 1)
        }
        $('#online [data-chat="p_' + data.from + '"] .time').html(data.time.substring(0, 5))
        return true
    }
    let div = document.getElementById('content_form')
    div.innerHTML += html;
    div.scrollTop = div.scrollHeight;
}


function send_message() {
    if (!ws || ws.readyState === ws.CLOSED) {
        alert('连接聊天室失败，请刷新重试');
        return;
    }

    //传输文件
    if ($("#upload_file").val() !== '') {
        let user = $('#username').val();
        let toUser = $('#toUsername').html();
        let toUID = USER_ID_MAP[toUser]
        let avatar = $('#user_avatar').attr('src');
        let name = $('#name').html();
        let file = document.getElementById('upload_file').files[0];
        let form = new FormData()
        let url = preUrl + 'file/send_file' //服务器上传地址
        let xhr = new XMLHttpRequest();
        xhr.open("post", url, true);
        form.append('file', file);
        form.append("to", toUID)
        form.append("form", user)
        form.append("user", user)
        form.append("avatar", avatar)
        form.append("name", name)

        let fileurl = ''
        xhr.addEventListener("readystatechange", function () {
            let result = xhr;
            let resp = JSON.parse(result.responseText)
            if (result.status !== 200) { //error
                console.log('上传失败', result.status, result.statusText, result.response);
            } else if (result.readyState === 4) { //finished
                console.log('上传成功 url:', resp.url);
                fileurl = preUrl + resp.url

                let div = document.getElementById('content_form_' + toUser)
                if (resp.file_type === "img") {
                    div.innerHTML += '<div class="bubble me">' + '<img style="width: 100px" src="' + fileurl + '">' + '</div>';
                } else {
                    div.innerHTML += '<div class="bubble me">' + '<a href="' + fileurl + '">' + file.name + '</a>' + '</div>';
                }

                div.scrollTop = div.scrollHeight;
                $("#upload_file").val("");
            }
        });
        xhr.send(form); //开始发送
    } else {
        let text = document.getElementById('text').value;
        let name = $('#name').html();
        let avatar = $('#user_avatar').attr('src');
        let user = $('#username').val();
        let toUser = $('#toUsername').html();
        let toUID = USER_ID_MAP[toUser]
        if (!text || !text.replace(/(^\s+)|(\s+$)/g, '')) {
            return false
        }

        // md5
        let md5Text = md5(text)
        console.log("消息内容hash完成(md5)：", md5Text)

        // 签名
        let sign = rsaUtil.mySign(md5Text, RSA_KEY_PAIR.privateKey);
        console.log("签名完成！sign: ", sign)

        // 生成秘钥
        AES_KEY = aesUtil.genKey()
        console.log("生成对称加密的密钥：" + AES_KEY)
        // 获取加密模式
        console.log("selected aes mode: ", AESModeMap[AESMode])

        // 加密
        let encryptedText = aesUtil.encrypt(sign + SplitStr + text, AES_KEY, AESMode)
        console.log("数据加密完成！密文为: ", encryptedText)

        // Key加密
        let encryptedKey = rsaUtil.encrypt(AES_KEY + SplitStr + AESMode, pubKeysMap[toUID])
        console.log("收方公钥加密的对称密钥: ", encryptedKey)

        let content = encryptedText
        ws.send(JSON.stringify({
            'type': toUser === '大厅' ? 'say' : 'private',
            'data': {
                'content': toUser === '大厅' ? text : content,
                'avatar': avatar ? avatar : '/img/dog.png',
                name: name,
                user: user,
                to: toUID,
                key: encryptedKey
            }
        }));
        console.log("消息发送完成 msg密文: ", content)

        let div = document.getElementById(toUser === '大厅' ? 'content_form' : 'content_form_' + toUser)
        div.innerHTML += '<div class="bubble me">' + text + '</div>';
        div.scrollTop = div.scrollHeight;
        $('#text').val('')
    }
}

document.getElementById('button-send').onclick = function (event) {
    send_message();
}
document.getElementById('text').onkeypress = function (event) {
    if ((event.which || e.keyCode) == 13) {
        send_message();
        event.preventDefault();
    }
}

// function pushMsg(history) {
//     let historyHtml = ''
//     history.forEach(function (res) {
//         if (res.body === 'time') {
//             historyHtml += '<div class="conversation-start">' +
//                 '<span>' + res.time + '</span>' +
//                 '</div>';
//         } else if (res.body === 'you') {
//             historyHtml += '<div class="group_you">' +
//                 '<img src="' + res.avatar + '" alt="" class="avatar"/>' +
//                 '<div class="you_name">' + res.user + '</div>' +
//                 '<div class="bubble you_msg">' + res.msg +
//                 '</div>' +
//                 '</div>';
//         } else {
//             historyHtml += '<div class="bubble me">' + res.msg + '</div>';
//         }
//     })
//     let div = document.getElementById('content_form')
//     div.innerHTML = historyHtml;
//     div.scrollTop = div.scrollHeight;
// }

function initFriends(people, time, num) {
    let uid = $('#uid').val();
    console.log(uid)
    let html = '<li class="labels">\n' +
        '<span class="label-name" id="label-name1" hidden></span>' + '<ul class="label">' +
        '<li class="person active" data-chat="chat_group" data-msg="0">' +
        '<img src="/img/group.jpg" alt=""/>' +
        '<span class="name">大厅</span>' +
        '<span class="time">' + time.substring(0, 5) + '</span>' +
        '<div class="preview pp_status status away">' +
        '当前在线<b id="people">' + num + '</b>人</div>' +
        '<div class="preview new_blink" style="display: none">' +
        '<span class="status online"></span>你有<b class="msg_length">0</b>条新的消息</div>' +
        '</li> </ul> </li>',

        chat = '<div class="chat active-chat" id="content_form" data-chat="chat_group">' +
            '<div class="conversation-start">' +
            '<span>Today, ' + time + '</span>' +
            '</div>' +
            '</div>';
    console.log(people)
    Object.keys(people).forEach(function (k) {
        let label_v = people[k]
        console.log(k)
        console.log(label_v)
        html += '<li class="labels" id="labels_' + k + '">' +
            '<span class="label-name" id="label-name_' + k + '" onclick=changeStatus("' + k + '")  >' + k + '</span>' +
            '<ul class="label" id="label_' + k + '">'
        Object.keys(label_v).forEach(function (fid) {
            if (fid !== uid.toString()) {
                FRIEND_IDS.push(fid)
                let v = label_v[fid]
                USER_ID_MAP[v.name] = fid
                userLabelMap[fid] = k
                html += '<li class="person" data-chat="p_' + v.name + '" data-msg="0">' +
                    '<img src="' + v.avatar + '" alt=""/>' +
                    '<span class="name">' + v.name + '</span>' +
                    '<span class="time">' + time.substring(0, 5) + '</span>'
                if (v.online === true) {
                    html += '<div class="preview pp_status status online">Online</div>' +
                        '<div class="preview new_blink" style="display: none">' +
                        '<span class="status online"></span>你有<b class="msg_length">0</b>条新的消息</div>' +
                        '</li>'
                } else {
                    html += '<div class="preview pp_status status offline">Offline</div>' +
                        '</li>'
                }

                chat += '<div class="chat" id="content_form_' + v.name + '" data-chat="p_' + v.name + '">' +
                    '<div class="conversation-start">' +
                    '<span>Today, ' + time + '</span>' +
                    '</div>' +
                    '</div>';
            }
        })
        html += '</ul>' + '</li>'
    })

    $('#online').html(html)
    $('#online_chat').html(chat)
    allReady()
}

function showSearchResult(results) {
    let uid = $('#uid').val();
    let userhtml = $('#online')[0].innerHTML
    let chathtml = $('#online_chat')[0].innerHTML
    if (onlineUserHtml === "") {
        onlineUserHtml = userhtml
        onlineChatHtml = chathtml
    }
    let chat = '<div class="chat active-chat" id="content_form" data-chat="chat_group">' +
        '<div class="conversation-start">' +
        '</div>' +
        '</div>'
    let phtml = '<li class="person active" data-chat="chat_group" data-msg="0" hidden></li>' +
        '<li class="labels" id="labels_search">' +
        '<span class="label-name" id="label-name_search" hidden> </span>' +
        '<ul class="label" id="label_search">'
    Object.keys(results).forEach(function (sid) {
        if (sid !== uid.toString()) {
            let v = results[sid]
            USER_ID_MAP[v.name] = sid
            if (!FRIEND_IDS.includes(sid)) {
                userLabelMap[sid] = "Default"
            }
            phtml += '<li class="person" data-chat="p_' + v.name + '" data-msg="0">' +
                '<img src="' + v.avatar + '" alt=""/>' +
                '<span class="name">' + v.name + '</span>' +
                '<span class="time" hidden></span>'
            if (v.online === true) {
                phtml += '<div class="preview pp_status status online">Online</div>' +
                    '<div class="preview new_blink" style="display: none">' +
                    '<span class="status online"></span>你有<b class="msg_length">0</b>条新的消息</div>' +
                    '</li>'
            } else {
                phtml += '<div class="preview pp_status status offline">Offline</div>' +
                    '</li>'
            }
            chat += '<div class="chat" id="content_form_' + v.name + '" data-chat="p_' + v.name + '">' +
                '<div class="conversation-start">' +
                '</div>' +
                '</div>';
        }
    })
    phtml += '</ul>' + '</li>'
    $('#online').html(phtml)
    $('#online_chat').html(chat)
    allReady()
}

function peopleEnter(data) {
    let newP = data.name
    let uid = data.uid
    USER_ID_MAP[newP] = uid
    pubKeysMap[uid] = data.pub_key

    if ($('#online [data-chat="p_' + newP + '"]').length > 0) {
        // $('#online [data-chat="p_' + data.name + '"] .status').removeClass('offline').addClass('online').html('Online');
        if ($('#online [data-chat="p_' + data.name + '"] .pp_status').is(':hidden')) {
            $('#online [data-chat="p_' + data.name + '"] .status').removeClass('offline').addClass('online');
        } else {
            $('#online [data-chat="p_' + data.name + '"] .status').removeClass('offline').addClass('online').html('Online');
        }
    } else {
        // let html = $('#online')[0].innerHTML,
        //     chat = $('#online_chat')[0].innerHTML;
        // html += '<li class="person" data-chat="p_' + newP + '" data-msg="0">' +
        //     '<img src="' + v.avatar + '" alt=""/>' +
        //     '<span class="name">' + v.name + '</span>' +
        //     '<span class="time">' + data.time.substring(0, 5) + '</span>' +
        //     '<div class="preview pp_status status online">Online</div>' +
        //     '<div class="preview new_blink" style="display: none">' +
        //     '<span class="status online"></span>你有<b class="msg_length">0</b>条新的消息</div>' +
        //     '</li>';
        // chat += '<div class="chat" id="content_form_' + v.name + '" data-chat="p_' + v.name + '">' +
        //     '<div class="conversation-start">' +
        //     '<span>Today, ' + data.time + '</span>' +
        //     '</div>' +
        //     '</div>';
        // $('#online').html(html)
        // $('#online_chat').html(chat)
    }
    $('#people').html(data.people_num)
    allReady()
}

function peopleLeave(data) {
    $('#people').html(Object.keys(data.people).length)
    console.log('hidden', $('#online [data-chat="p_' + data.name + '"] .pp_status').is(':hidden'))
    console.log('visible', $('#online [data-chat="p_' + data.name + '"] .pp_status').is(':visible'))
    if ($('#online [data-chat="p_' + data.name + '"] .pp_status').is(':hidden')) {
        $('#online [data-chat="p_' + data.name + '"] .status').removeClass('online').addClass('offline');
    } else {
        $('#online [data-chat="p_' + data.name + '"] .status').removeClass('online').addClass('offline').html('Offline');
    }
}

function getHitory(user) {
    ws.send(JSON.stringify({'type': 'history', 'data': {'user': user,}}));

}

function allReady() {
    // document.querySelector('.person[data-chat=chat_group]').classList.add('active');
    // document.querySelector('.chat[data-chat=chat_group]').classList.add('active-chat');
    gotoEnd()
    let friends = {
            list: document.querySelector('ul.people'),
            all: document.querySelectorAll('.left .person'),
            name: ''
        },

        chat = {
            container: document.querySelector('.container .right'),
            current: null,
            person: null,
            name: document.querySelector('.container .right .top .name')
        };


    friends.all.forEach(function (f) {
        f.addEventListener('mousedown', function () {
            f.classList.contains('active') || setAciveChat(f, friends, chat);
        });
    });

}

function setAciveChat(f, friends, chat) {
    friends.list.querySelector('.active').classList.remove('active');
    f.classList.add('active');
    chat.current = chat.container.querySelector('.active-chat');
    chat.person = f.getAttribute('data-chat');
    chat.current.classList.remove('active-chat');
    chat.container.querySelector('[data-chat="' + chat.person + '"]').classList.add('active-chat');
    friends.name = f.querySelector('.name').innerText;
    chat.name.innerHTML = friends.name;
    if (friends.name === '大厅') {
        $('#online [data-chat="chat_group"] .new_blink').hide()
        $('#online [data-chat="chat_group"] .pp_status').show()
        $('#online [data-chat="chat_group"]').attr('data-msg', 0)
        document.getElementById("add-or-del").setAttribute("visibility", "hidden")
        document.getElementById("friend-label-div").setAttribute("visibility", "hidden")
        document.getElementById("friend-label-span").style.display = "none"
        document.getElementById("friend-label-input").style.display = "none"
        document.getElementById("add-friend").style.display = "none"
        document.getElementById("del-friend").style.display = "none"
    } else {
        $('#online [data-chat="p_' + friends.name + '"] .new_blink').hide()
        $('#online [data-chat="p_' + friends.name + '"] .pp_status').show()
        $('#online [data-chat="p_' + friends.name + '"]').attr('data-msg', 0)
        document.getElementById("add-or-del").removeAttribute("visibility")
        let fid = USER_ID_MAP[friends.name]
        document.getElementById("friend-label-div").removeAttribute("visibility")
        document.getElementById("friend-label-span").style.display = "block"
        document.getElementById("friend-label-input").style.display = "block"
        if (FRIEND_IDS.includes(fid)) {
            $(".friend-label").focus(function () {
                this.classList.add('active');
                this.setAttribute("friend_id", fid)
                $(".friend-label.active").blur(function () {
                    changeLabel(this);
                })
            });
            document.getElementById("friend-label-input").value = userLabelMap[fid]
            document.getElementById("add-friend").style.display = "none"
            document.getElementById("del-friend").style.display = "block"
        } else {
            $(".friend-label").focus(function () {
                this.classList.add('active');
                this.setAttribute("friend_id", fid)
                $(".friend-label.active").blur(function () {
                    changeLabel(this);
                })
            });
            document.getElementById("friend-label-input").value = "Default"
            document.getElementById("add-friend").style.display = "block"
            document.getElementById("del-friend").style.display = "none"
        }
    }
    gotoEnd()
}

function gotoEnd() {
    let div = $('.container .right .active-chat')[0];
    console.log(div.innerHTML)
    div.scrollTop = div.scrollHeight;
}


$(".write-link.attach").bind('click', function () {
    $(this).prev(".select-file").click();
});

// 监听搜索框的文字变化
$(".search-text").bind('input propertychange', function () {
    let text = document.getElementById("search-text").value
    // console.log(text)
    // console.log(onlineUserHtml)
    if (text === "" && onlineChatHtml !== "") {
        $('#online').html(onlineUserHtml)
        $('#online_chat').html(onlineChatHtml)
        allReady()
        onlineUserHtml = ""
        onlineChatHtml = ""
    }
})


$(".add-friend").bind("click", function () {
    let add_friend = $('#toUsername').html();
    let add_uid = USER_ID_MAP[add_friend]
    if (confirm("是否添加好友:" + add_friend + "\n分组: " + userLabelMap[add_uid])) {
        let xhr = new XMLHttpRequest();
        let form = new FormData()
        xhr.open("post", preUrl + "user/add_friend", true);
        form.append('uid', $('#uid').val());
        form.append('name', add_friend)
        form.append("add_uid", add_uid)
        form.append("label", userLabelMap[add_uid])
        xhr.addEventListener("readystatechange", function () {
            let result = xhr;
            let resp = JSON.parse(result.responseText)
            if (result.status !== 200) { //error
                console.log("服务错误 err:" + result.status)
            } else if (result.readyState === 4) { //finished
                console.log(resp)
            }
        });
        xhr.send(form); //开始发送
    }
})

$(".del-friend").bind("click", function () {
    let del_friend = $('#toUsername').html();
    if (confirm("是否删除好友" + del_friend)) {
        let del_uid = USER_ID_MAP[del_friend]
        let xhr = new XMLHttpRequest();
        let form = new FormData()

        xhr.open("post", preUrl + "user/del_friend", true);
        form.append('uid', $('#uid').val());
        form.append("del_uid", del_uid)
        xhr.addEventListener("readystatechange", function () {
            let result = xhr;
            let resp = JSON.parse(result.responseText)
            if (result.status !== 200) { //error
                console.log("err:" + result.status)
            } else if (result.readyState === 4) { //finished
                console.log(resp)
            }
        });
        xhr.send(form); //开始发送
    }
})

function changeLabel(inpt) {
    //let inpt= $("#friend-label active")
    inpt.classList.remove('active');
    let text = inpt.value
    let uid = inpt.getAttribute("friend_id")
    console.log(uid)
    console.log(FRIEND_IDS)
    console.log(userLabelMap)
    if (text !== userLabelMap[uid] && FRIEND_IDS.includes(uid)) {
        if (confirm("标签变化:" + userLabelMap[uid] + "->" + text)) {
            userLabelMap[uid] = text
            let xhr = new XMLHttpRequest();
            let form = new FormData()

            xhr.open("post", preUrl + "user/change_label", true);
            form.append('uid', $('#uid').val());
            form.append("fid", uid)
            form.append("label", text)
            xhr.addEventListener("readystatechange", function () {
                let result = xhr;
                let resp = JSON.parse(result.responseText)
                if (result.status !== 200) { //error
                    console.log("err:" + result.status)
                } else if (result.readyState === 4) { //finished
                    console.log(resp)
                }
            });
            xhr.send(form); //开始发送
        } else {
            inpt.value = userLabelMap[uid]
        }
    } else if (text !== userLabelMap[uid] && !FRIEND_IDS.includes(uid)) {
        inpt.value = text
        userLabelMap[uid] = text
        console.log(uid, text)
    }
}

function changeStatus(label) {
    console.log(label)
    let l = document.getElementById('label_' + label)
    if (l.style.display === 'none') {
        l.style.display = 'block'
        l.css.borderTop = "5px solid white"
        l.css.borderLeft = "4px solid transparent"
        l.css.borderRight = "4px solid transparent"
        //      border-left: 10px solid white;
        // border-top: 8px solid transparent;
        // border-bottom: 8px solid transparent;
    } else {
        l.style.display = 'none'
    }
}

// 好友验证
function friendsVerify(data) {
    console.log(data)
    let people = data.people
    Object.keys(people).forEach(function (k) {
        v = people[k]
        let is_agree = confirm(v.name + "添加好友\n" + v.time)
        let xhr = new XMLHttpRequest();
        let form = new FormData()
        xhr.open("post", preUrl + "user/agree_add_fr", true);
        form.append('uid', $('#uid').val());
        form.append("fid", k)
        form.append('is_agree', is_agree ? "yes" : "no")
        xhr.addEventListener("readystatechange", function () {
            let result = xhr;
            let resp = JSON.parse(result.responseText)
            if (result.status !== 200) { //error
                console.log("err:" + result.status)
            } else if (result.readyState === 4) { //finished
                console.log(resp)
            }
        });
        xhr.send(form); //开始发送
    })
}

function initFriendReq() {
    let xhr = new XMLHttpRequest();
    let form = new FormData()
    xhr.open("post", preUrl + "user/init", true);
    form.append('uid', $('#uid').val());
    xhr.addEventListener("readystatechange", function () {
        let result = xhr;
        let resp = JSON.parse(result.responseText)
        if (result.status !== 200) { //error
            console.log("err:" + result.status)
        } else if (result.readyState === 4) { //finished
            console.log(resp)
        }
    });
    xhr.send(form); //开始发送
}

$(".do-search").bind('click', function () {
    let l = document.getElementById('search-text')
    let text = l.value
    console.log(text)
    if (text === "") {
        return
    }
    let search_uid = "0";
    let search_name = "";
    // 判断搜索框中输入的是昵称还是ID
    let r = /^\+?[1-9][0-9]*$/;
    if (r.test(text)) {
        search_uid = text
    } else {
        search_name = text
    }

    let uid = $('#uid').val();
    let xhr = new XMLHttpRequest();
    let form = new FormData()

    xhr.open("post", preUrl + "user/find_user", true);
    form.append('search_uid', search_uid);
    form.append("search_name", search_name)
    form.append("uid", uid)
    // 接收请求结果
    xhr.addEventListener("readystatechange", function () {
        let result = xhr;
        let resp = JSON.parse(result.responseText)
        if (result.status !== 200) { //error
            console.log("err:" + result.status)
        } else if (result.readyState === 4) { //finished
            console.log(resp)
        }
    });
    xhr.send(form); //开始发送
})

let rsaUtil = {
    //RSA 位数
    bits: 1024,

    thisKeyPair: {},

    //生成密钥对(公钥和私钥)
    genKeyPair: function (bits = rsaUtil.bits) {
        let genKeyPair = {};
        rsaUtil.thisKeyPair = new JSEncrypt({default_key_size: bits});
        //获取私钥
        genKeyPair.privateKey = rsaUtil.thisKeyPair.getPrivateKey();
        //获取公钥
        genKeyPair.publicKey = rsaUtil.thisKeyPair.getPublicKey();

        return genKeyPair;
    },

    //公钥加密
    encrypt: function (plaintext, publicKey) {
        publicKey && rsaUtil.thisKeyPair.setPublicKey(publicKey);
        return rsaUtil.thisKeyPair.encrypt(plaintext);
    },

    //私钥解密
    decrypt: function (ciphertext, privateKey) {
        privateKey && rsaUtil.thisKeyPair.setPrivateKey(privateKey);
        return rsaUtil.thisKeyPair.decrypt(ciphertext);
    },
    mySign: function (data, privateKey) {
        let sig = new JSEncrypt();
        sig.setPrivateKey(privateKey);
        return sig.sign(data, CryptoJS.SHA256, "base64");

    },

    myVerify: function (data, signedData, publicKey) {
        let sig = new JSEncrypt();
        sig.setPublicKey(publicKey);
        return sig.verify(data, signedData, CryptoJS.SHA256);
    }
};


let aesUtil = {
    genKey: function (length = 16) {
        let random = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let str = "";
        for (let i = 0; i < length; i++) {
            str = str + random.charAt(Math.random() * random.length)
        }
        return str;
    },

    //加密
    encrypt: function (plaintext, key, mode) {
        let encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(plaintext), CryptoJS.enc.Utf8.parse(key), {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });

        if (mode === 'modeB') {
            encrypted.mode = CryptoJS.mode.CBC
        }
        return encrypted.toString();
    },

    //解密
    decrypt: function (ciphertext, key, mode) {
        let decrypt = CryptoJS.AES.decrypt(ciphertext, CryptoJS.enc.Utf8.parse(key), {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });

        if (mode === 'modeB') {
            decrypt.mode = CryptoJS.mode.CBC
        }

        return CryptoJS.enc.Utf8.stringify(decrypt).toString();
    }
};