let os;
window.addEventListener("DOMContentLoaded", init);

var canvas = document.getElementById('canvas');
var container = document.getElementById('canvas-container');

canvas.width = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
var ctx_x = canvas.getContext('2d');
var ctx_y = canvas.getContext('2d');
var ctx_z = canvas.getContext('2d');
var xx = document.getElementById('xx');
var yy = document.getElementById('yy');
var zz = document.getElementById('zz');
var sh = document.getElementById('shindo');

var b_x = 0, b_y = 0, b_z = 0;

var x_arr = [];
var y_arr = [];
var z_arr = [];


//初期化
function init() {
    scrollTo(0, 0)
    container.scrollTo(0, 0);
    os = detectOSSimply();
    if (os == "iphone" || os == "iPad") {
        // safari用。DeviceOrientation APIの使用をユーザに許可して貰う
        document.querySelector("#permit").addEventListener("click", permitDeviceOrientationForSafari);
        // window.addEventListener(
        //     "deviceorientation",
        //     detectAcceleration,
        //     true
        // );
    } else if (os == "android") {
        window.addEventListener(
            "deviceorientationabsolute",
            detectAcceleration,
            true
        );
    } else {
        window.alert("Not compatible with PCs");
    }
}


var cul_count = 0;

// 加速度が変化した時に実行される関数
function detectAcceleration(event) {
    // 加速度の情報を取得
    const acceleration = event.acceleration;

    var x_x = acceleration.x * 100;
    var y_y = acceleration.y * 100;
    var z_z = acceleration.z * 100;

    xx.innerHTML = x_x;
    yy.innerHTML = y_y;
    zz.innerHTML = z_z;

    // データを描画する
    draw(x_x, y_y, z_z);

    //データ保存
    x_arr.push(x_x);
    y_arr.push(y_y);
    z_arr.push(z_z);

    if (x_arr.length > 50) {
        x_arr.shift()
        y_arr.shift()
        z_arr.shift()
    }

    cul_count += 1;
    if (cul_count % 30 == 0) {
        var shindo = calculateShindo(x_arr, y_arr, z_arr);
        sh.innerHTML = shindo;
    }



}


var axis = 1;
var mag = 0.3;
var speed = 2;

// データ描画
function draw(x, y, z) {

    // 点をプロットする位置を計算
    var pointX = (x * mag) + (canvas.height / 2);
    var pointY = (y * mag) + (canvas.height / 2);
    var pointZ = (z * mag) + (canvas.height / 2);

    // 点を描画
    ctx_x.strokeStyle = 'red';
    ctx_x.beginPath();
    ctx_x.moveTo(axis - 1, b_x)
    ctx_x.lineTo(axis, pointX)
    ctx_x.stroke()
    ctx_y.strokeStyle = 'blue';
    ctx_y.beginPath();
    ctx_y.moveTo(axis - 1, b_y)
    ctx_y.lineTo(axis, pointY)
    ctx_y.stroke()
    ctx_z.strokeStyle = 'green';
    ctx_z.beginPath();
    ctx_z.moveTo(axis - 1, b_z)
    ctx_z.lineTo(axis, pointZ)
    ctx_z.stroke()

    b_x = pointX
    b_y = pointY
    b_z = pointZ


    axis += speed
    container.scrollTo(axis - 500, 0)

}


//震度

//fftは多分いける

function calculateShindo(acceleration_x, acceleration_y, acceleration_z) {
    var fs = 100

    // 1. ディジタル加速度記録3成分（水平動2成分、上下動1成分）のそれぞれのフーリエ変換を求める。
    var x_FFT = math.fft(acceleration_x);
    var y_FFT = math.fft(acceleration_y);
    var z_FFT = math.fft(acceleration_z);

    var num = x_FFT.length; // データ数(列数)
    var n = Array.from(Array(num).keys()); // プロット軸元ネタ
    // 0割回避＆疑似0値のため微小値を加算
    var f = n.map(x => x / (num / fs) + 0.0000001); // 関数窓用プロット軸
    // 周期効果関数窓
    var winX = f.map(x => Math.sqrt(1 / x));

    // ハイカット関数窓
    var Y = f.map(x => x / 10);
    var winY = Y.map(y => 1 / Math.sqrt(1 + 0.694 * Math.pow(y, 2) + 0.241 * Math.pow(y, 4) + 0.0557 * Math.pow(y, 6) + 0.009664 * Math.pow(y, 8) + 0.00134 * Math.pow(y, 10) + 0.000155 * Math.pow(y, 12)));

    // ローカット関数窓
    var winZ = f.map(x => Math.sqrt(1 - Math.exp(-Math.pow(x / 0.5, 3))));

    // 関数窓合成
    var win1 = winX.map((x, i) => x * winY[i] * winZ[i]); // 前半分用
    var win2 = winX.slice().reverse().map((x, i) => x * winY.slice().reverse()[i] * winZ.slice().reverse()[i]); // 後半用

    var nn = Math.floor(num / 2);
    var win = [...win1.slice(0, nn), win1[nn], ...win2.slice(nn + 1)];

    // バンドパスフィルタ
    var fft_ns_ = x_FFT.map((x, i) => math.multiply(x, win[i]));
    var fft_ew_ = y_FFT.map((x, i) => math.multiply(x, win[i]));
    var fft_ud_ = z_FFT.map((x, i) => math.multiply(x, win[i]));


    // 逆フーリエ変換
    var res_ns = math.ifft(fft_ns_);
    var res_ew = math.ifft(fft_ew_);
    var res_ud = math.ifft(fft_ud_);

    // 合成加速度
    var anorm = res_ns.map((x, i) => Math.sqrt(Math.pow(x.re, 2) + Math.pow(x.im, 2) + Math.pow(res_ew[i].re, 2) + Math.pow(res_ew[i].im, 2) + Math.pow(res_ud[i].re, 2) + Math.pow(res_ud[i].im, 2)));

    // 降順ソート
    var sorted_anorm = anorm.slice().sort((a, b) => b - a);

    // 0.3秒後のデータサンプル確保(開始位置を0秒とする。)
    var S = sorted_anorm[Math.floor(0.3 * fs) + 1];

    // 気象庁指定の演算で震度算出
    var I = 2 * Math.log10(S) + 0.94;
    var y = Math.floor(10 * (I + 0.005)) / 10; // 小数第3位を四捨五入し、小数第2位を切り捨て


    return y;
}









//<<----関数---->>


// 簡易OS判定
function detectOSSimply() {
    let ret;
    if (
        navigator.userAgent.indexOf("iPhone") > 0 ||
        navigator.userAgent.indexOf("iPad") > 0 ||
        navigator.userAgent.indexOf("iPod") > 0
    ) {
        // iPad OS13のsafariはデフォルト「Macintosh」なので別途要対応
        ret = "iphone";
    } else if (navigator.userAgent.indexOf("Android") > 0) {
        ret = "android";
    } else {
        ret = "pc";
    }

    return ret;
}


//safari許可してくれの場所
function permitDeviceOrientationForSafari() {
    DeviceOrientationEvent.requestPermission()
        .then(response => {
            if (response === "granted") {
                window.addEventListener("devicemotion", detectAcceleration);
            }
        })
        .catch(error => {
            alert('このデバイスは加速度センサーに対応していません。' + error);
        })
};


// 端末の傾き補正（Android用）
// https://www.w3.org/TR/orientation-event/
function compassHeading(alpha, beta, gamma) {
    var degtorad = Math.PI / 180; // Degree-to-Radian conversion

    var _x = beta ? beta * degtorad : 0; // beta value
    var _y = gamma ? gamma * degtorad : 0; // gamma value
    var _z = alpha ? alpha * degtorad : 0; // alpha value

    var cX = Math.cos(_x);
    var cY = Math.cos(_y);
    var cZ = Math.cos(_z);
    var sX = Math.sin(_x);
    var sY = Math.sin(_y);
    var sZ = Math.sin(_z);

    // Calculate Vx and Vy components
    var Vx = -cZ * sY - sZ * sX * cY;
    var Vy = -sZ * sY + cZ * sX * cY;

    // Calculate compass heading
    var compassHeading = Math.atan(Vx / Vy);

    // Convert compass heading to use whole unit circle
    if (Vy < 0) {
        compassHeading += Math.PI;
    } else if (Vx < 0) {
        compassHeading += 2 * Math.PI;
    }

    return compassHeading * (180 / Math.PI); // Compass Heading (in degrees)
}














// ジャイロスコープと地磁気をセンサーから取得
// function orientation(event) {

//     let absolute = event.absolute;
//     let alpha = event.alpha;
//     let beta = event.beta;
//     let gamma = event.gamma;

//     let degrees;
//     if (os == "iphone") {
//         // webkitCompasssHeading値を採用
//         degrees = event.webkitCompassHeading;

//     } else {
//         // deviceorientationabsoluteイベントのalphaを補正
//         degrees = compassHeading(alpha, beta, gamma);
//     }

//     degrees = degrees.toPrecision(8);
//     //document.querySelector("#direction").innerHTML = direction + " : " + degrees;




// }



//
//
// let direction;
// if (
//     (degrees > 337.5 && degrees < 360) ||
//     (degrees > 0 && degrees < 22.5)
// ) {
//     direction = "N";
// } else if (degrees > 22.5 && degrees < 67.5) {
//     direction = "NE";
// } else if (degrees > 67.5 && degrees < 112.5) {
//     direction = "E";
// } else if (degrees > 112.5 && degrees < 157.5) {
//     direction = "SE";
// } else if (degrees > 157.5 && degrees < 202.5) {
//     direction = "S";
// } else if (degrees > 202.5 && degrees < 247.5) {
//     direction = "SW";
// } else if (degrees > 247.5 && degrees < 292.5) {
//     direction = "W";
// } else if (degrees > 292.5 && degrees < 337.5) {
//     direction = "NW";
// }