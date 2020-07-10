function login() {
    let name = document.getElementById("nick-name").value;

    $.post("/chat");
    return
}

$("#button-login").click(function(event){
    login();
})