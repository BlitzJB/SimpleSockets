const joinbutton = document.querySelector('.joinbutton');
const link = document.querySelector('#link');

joinbutton.addEventListener('click', () => {
    if (!link.value)
        return;
    // url pattern should match http://127.0.0.1:5500/room/roomID
    if (!link.value.match(/http:\/\/127\.0\.0\.1:5500\/room\/[a-z0-9]+/))
        return;
    window.location.href = link.value;
})

function createRandomString() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 6; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

const createRoomButton = document.querySelector('button');
createRoomButton.addEventListener('click', () => {
    window.location.href = `/room/${createRandomString()}`;
})
