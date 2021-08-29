function createStore(reducer){
    let state = reducer(undefined, {})
    let cbs   = []
    function dispatch(action){
        if (typeof action === 'function'){
            return action(dispatch)
        }
        const newState = reducer(state, action)
        if (state !== newState){
            state = newState
            cbs.forEach(cb => cb())
        }
    }
    return {
        dispatch,
        subscribe(cb){
            cbs.push(cb)
            return () =>  cbs = cbs.filter(c => c !== cb)
        },
        getState(){
            return state
        }
    }
}
function promiseReducer(state={}, {type, status, payload, error, name}){
    if (type === 'PROMISE'){
        return {
            ...state,
            [name]:{status, payload, error}
        }
    }
    return state
}


//под товаром сделать кнопку "купить"




const actionPending = name => ({type: 'PROMISE', status: 'PENDING', name})
const actionResolved = (name, payload) => ({type: 'PROMISE', status: 'RESOLVED', name, payload})
const actionRejected = (name, error) => ({type: 'PROMISE', status: 'REJECTED', name, error})

const delay = ms => new Promise(ok => setTimeout(() => ok(ms), ms))

const actionPromise = (name, promise) => 
    async dispatch => {
        dispatch(actionPending(name))
        try{
            let payload = await promise
            dispatch(actionResolved(name, payload)) 
            return payload
        }
        catch(error){
             dispatch(actionRejected(name, error))
        }
    }

    function cartReducer(state={},{type , count = 1, _id , name , price }) {
        if(type === 'CART_ADD'){
            return {
                ...state , 
                [_id]:{count:(state[_id]?.count || 0) + count, name , price}

            }
        }
    
        if (type === 'CART_CHANGE' ) {
            return {
                ...state,
                [_id]:{count:state[count] = count,price}
            }
        }
    
        if(type === 'CART_REMOVE'){
            let {[_id]:id , ...res} = state
            return res
        }
    
        if (type === "CART_CLEAR"){
            return {}
        }
        return state
    }
    
    
    
    // store.dispatch({type: 'CART_ADD', _id:id, count:num})
    // store.dispatch({type: 'CART_CHANGE', _id:id, count:count})
    // store.dispatch({type: 'CART_REMOVE', _id:id})
    // store.dispatch({type: 'CART_CLEAR'})

    let reducers = {
        promise:promiseReducer,
        cart:cartReducer,
        auth:authReducer
    }
    
    function combineReducers(reducers){
        function commonReducer(state = {} , action){
            let commonState = {}
            for(let reducerName in reducers){
                const reducerState = reducers[reducerName](state[reducerName],action)
                if (reducerState !== state[reducerName]){
                    commonState[reducerName] = reducerState
                }
            }
            if (Object.keys(commonState).length == 0){
              return state
            } 
            return {...state,...commonState}
        }
        return commonReducer
    }

    
    const store = createStore(combineReducers(reducers))
    
    const unsubscribe = store.subscribe(() => console.log(store.getState()))
    

    // store.dispatch({type: 'CART_ADD', _id:'beer', count:2})
    
    const getGQL = url => 
    (query, variables={}) => fetch(url, {
        method: 'POST',
        headers: {
            //  Accept: "application/json",
            "Content-Type": "application/json",
            ...(localStorage.authToken ? {Authorization: "Bearer " + localStorage.authToken} : {})
            
        },
        body: JSON.stringify({query, variables})
    }).then(res => res.json())
    
    let shopGQL = getGQL('http://shop-roles.asmer.fs.a-level.com.ua/graphql')

    function authReducer(state, action){ //....
        if (state === undefined){
            if (!localStorage.authToken){
                return {}
            }
            action.token = localStorage.authToken
            action.type = 'LOGIN'
            // добавить в action token из localStorage, и проимитировать LOGIN 
        }
        if (action.type === 'LOGIN'){
            console.log('ЛОГИН')
            localStorage.authToken = action.token
            function jwt_decode (token) {
                
                var start64Url = token.split('.')[1]
                return JSON.parse(atob(start64Url))
            }
            return {token: action.token, payload: jwt_decode(action.token)}
        }
        if (action.type === 'LOGOUT'){
            console.log('ЛОГАУТ')
            localStorage.removeItem("authToken")
            //вернуть пустой объект
            return {}
        }
        return state
    }
    
    const actionAuthLogin = token => ({type:'LOGIN', token})
    const actionAuthLogout = () => ({type:'LOGOUT'})
    
    let reg = async(login,password) => {
        let query = `mutation reg($l:String , $p:String) {
            UserUpsert(user:{
              login:$l ,
              password:$p
            }){
              _id
            }
          }`
    
          let qVariables = {
            "l":  login,
            "p": password
          }
          let result = await shopGQL(query,qVariables)
          return result
        }
    
    let log = async(login , password) => {
        let query = ` query log($l:String , $p:String){
            login(login:$l, password:$p)
          }`
    let qVariables = {
        "l":  login,
        "p": password 
    }
    let result = await shopGQL(query,qVariables)
    return result
    }
    
    actionRegister = (login,password) => async dispatch => {
        return await dispatch (actionPromise('register' , reg(login,password)))
    }
    
    
    const goodById = id => {
        let query = `query goodById($query:String) {
            GoodFindOne(query: $query ) {
                _id
                name
                description
                price
                images {
                    url
                }
            }
        }`
        let variables = {
            query: JSON.stringify([{_id: id}]) 
        } 
        let res = shopGQL(query,variables)
        return res
    }
    
    const actionGoodById = id => 
    actionPromise('goodById', goodById(id))
    
    const actionRootCategories = () =>
    actionPromise('rootCategories', shopGQL(`
    query cats($query:String){
        CategoryFind(query:$query){
            _id name 
        }
    }
    `, {query: JSON.stringify([{parent:null}])}))
    
    const actionCategoryById = (_id) => 
    actionPromise('catById', shopGQL(`query catById($query:String){
        CategoryFindOne(query:$query){
            _id name goods{
                _id name price description images{
                    url
                }
            }
        }
    }`, {query: JSON.stringify([{_id}])}))
    
    
    store.dispatch(actionRootCategories())

    actionCartAdd = (id , num=1, name, price) => 
        ({type: 'CART_ADD', _id:id, count:num,name , price})
    

    actionCartChange =  (id,count,price) => 
        ({type: 'CART_CHANGE', _id:id, count,price})
    

    actionCartRemove = (id) => 
        ({type: 'CART_REMOVE', _id:id})
    

    actionCartClear = () => 
        ({type: 'CART_CLEAR'})
    
    
    window.onhashchange = () => {
        let {1: route, 2:id} = location.hash.split('/')
        if (route === 'categories'){
            main.innerHTML = ''
            store.dispatch(actionCategoryById(id))
        }
        
        if (route === 'good'){
            main.innerHTML = ''
            store.dispatch(actionGoodById(id))
        }

        if (route === 'cart'){
         drawCart()
        }
        if (route === 'registration'){
            drawReg()
        }
        if (route === 'login'){
            drawLog()
        }
        // if (route === 'cabinet') {
        //     console.log('aaaa')
        // }
    }


     
    function drawMainMenu(){
        let cats = store.getState().promise.rootCategories.payload
        if (cats){ //каждый раз дорисовываются в body
            aside.innerText = ''
            for (let {_id, name} of cats.data.CategoryFind){
                let catA = document.createElement('a')
                catA.href = `#/categories/${_id}`
                catA.innerText = name
                aside.style.marginLeft = '20px'
                aside.append(catA)
            }
        }
    }
    
    store.subscribe(drawMainMenu)
    
    let aBasket = document.createElement('a')
    aBasket.href = "#/cart/"
    aBasket.style.color = '#008B8B'
    let imgBasket = document.createElement('img')
    imgBasket.style.float = 'right'
    let header = document.getElementById('header')
    header.style.height = '70px'
    let countBasket = document.createElement('p')
    let h1 = document.getElementById('h1')
    h1.style.float = 'left'
    h1.style.marginTop = '30px'
    countBasket.style.float = 'right'
    countBasket.style.marginLeft = '20px'
    countBasket.style.marginRight = '20px'
    countBasket.style.marginTop = '20px'
    countBasket.style.fontWeight = 'bold'
    countBasket.innerHTML = "Товаров в корзине:" + " " + 0
    imgBasket.src = "basket.png"
    imgBasket.style.width = '50px'
    imgBasket.style.marginLeft = '30px'
    aBasket.append(countBasket)
    aBasket.append(imgBasket)
    header.append(aBasket)
    
    const unsubscribe1 = store.subscribe(() => {
        let cartState = store.getState().cart
        var result = []
        for (key in cartState){
            result.push(cartState[key].count)
            if (result.length > 0) {
               countBasket.innerHTML ="Товаров в корзине:" + " " + result.reduce(function(a,b){
                    return a+b
                })
            }
            else {
                countBasket.innerHTML ="Товаров в корзине:" + " " + 0
            }
        }
    }) 

    let aRegBtn = document.createElement('a')
    let regBtn = document.createElement('button')
    let aLogBtn = document.createElement('a')
    let logBtn = document.createElement('button')
    aLogBtn.href = '#/login'
    logBtn.innerHTML = 'Вход'
    aRegBtn.style.marginTop = '30px'
    aLogBtn.style.marginTop = '30px'
    aLogBtn.style.marginLeft = '10px'
    aRegBtn.href = '#/registration'
    regBtn.innerHTML = "Регистрация"
    aRegBtn.style.float = 'right'
    aLogBtn.style.float = 'right'
    aLogBtn.append(logBtn)
    header.append(aLogBtn)
    aRegBtn.append(regBtn)
    header.append(aRegBtn)
    let aCabinet = document.createElement('a')
    aCabinet.href = '#/cabinet'

    function drawReg() {
        main.innerHTML = ""
        let h = document.createElement('h1')
        h.innerHTML = 'Регистрация'
        main.append(h)

function Password (parent , open) {
  let passwordInput = document.createElement ('input')
  let passwordCheckbox = document.createElement('input')
  let passwordSpan = document.createElement('span')
  let passwordContent = document.createElement('div')
  
  parent.append(passwordContent)
  passwordContent.append(passwordInput)
  passwordContent.append(passwordCheckbox)
  passwordContent.append(passwordSpan)
  passwordContent.style.marginTop = "15px"
  passwordContent.style.marginBottom = '20px'
  passwordInput.placeholder = "Enter a password"
  
  
  passwordCheckbox.type = 'checkbox'
  passwordCheckbox.style.marginLeft = '10px'
  passwordSpan.innerHTML = "Hide password"
  passwordSpan.style.marginLeft = "10px"
  
  passwordInput.onchange = () => {
    if(typeof this.onChange === 'function'){
      this.onChange(passwordInput.value)
    }
  }
  
  function showOrHide() {
    if (passwordCheckbox.checked) {
      passwordInput.setAttribute('type' , 'password')
    } else {
      passwordInput.setAttribute('type','text')
    }
  }
  
  passwordCheckbox.addEventListener('change' , showOrHide)
  
  this.setValue = function (text) {
    passwordInput.value = text
  }
  
  this.getValue = function () {
    return passwordInput.value
  }
  
  this.setOpen = function (checker) {
    showOrHide.call(this)
    passwordCheckbox.checked = checker
  }
  
  passwordCheckbox.onclick = () => {
    showOrHide()
    this.onOpenChange("нажали чекбокс")
  }
  
  this.getOpen = function () {
    return passwordCheckbox.checked 
  }
}

function LoginFormConstructor (parent , open) {
let passwordForm = document.createElement('div')
let loginForm = document.createElement('div')
let btnForm = document.createElement('div')
let loginInput = document.createElement('input')
loginInput.type = 'text'
loginInput.style.marginBottom = '10px'
loginInput.placeholder = "Enter a login"
let passwordInput = document.createElement('input')
passwordInput.type = 'password'
passwordInput.placeholder = "Enter a password"
let checkbox = document.createElement('input')
checkbox.type = 'checkbox'
checkbox.style.marginLeft = '7px'
let btn = document.createElement('button')
btn.style.marginLeft = '130px'
btn.style.marginTop = '10px'
btn.innerHTML = 'Log in'

parent.append(loginForm)
parent.append(passwordForm)
parent.append(btnForm)
loginForm.append(loginInput)
passwordForm.append(passwordInput)
passwordForm.append(checkbox)
btnForm.append(btn)


btn.onclick = () => {
    store.dispatch(actionFullRegister((loginInput.value), (passwordInput.value)))
}

function showOrHide() {
  if (checkbox.checked) {
    passwordInput.setAttribute('type' , 'text')
  } else {
    passwordInput.setAttribute('type','password')
  }
}
checkbox.addEventListener('change' , showOrHide)
}


let lfc = new LoginFormConstructor(main, true)
    }

    function drawLog() {
        main.innerHTML = ""
        let h = document.createElement('h1')
        h.innerHTML = 'Вход'
        main.append(h)

        function Password (parent , open) {
          let passwordInput = document.createElement ('input')
          let passwordCheckbox = document.createElement('input')
          let passwordSpan = document.createElement('span')
          let passwordContent = document.createElement('div')
          
          parent.append(passwordContent)
          passwordContent.append(passwordInput)
          passwordContent.append(passwordCheckbox)
          passwordContent.append(passwordSpan)
          passwordContent.style.marginTop = "15px"
          passwordContent.style.marginBottom = '20px'
          passwordInput.placeholder = "Enter a password"
          
          
          passwordCheckbox.type = 'checkbox'
          passwordCheckbox.style.marginLeft = '10px'
          passwordSpan.innerHTML = "Hide password"
          passwordSpan.style.marginLeft = "10px"
          
          passwordInput.onchange = () => {
            if(typeof this.onChange === 'function'){
              this.onChange(passwordInput.value)
            }
          }
          
          function showOrHide() {
            if (passwordCheckbox.checked) {
              passwordInput.setAttribute('type' , 'password')
            } else {
              passwordInput.setAttribute('type','text')
            }
          }
          
          passwordCheckbox.addEventListener('change' , showOrHide)
        }
        
        function LoginFormConstructor (parent , open) {
        let passwordForm = document.createElement('div')
        let loginForm = document.createElement('div')
        let btnForm = document.createElement('div')
        let loginInput = document.createElement('input')
        loginInput.type = 'text'
        loginInput.style.marginBottom = '10px'
        loginInput.placeholder = "Enter a login"
        let passwordInput = document.createElement('input')
        passwordInput.type = 'password'
        passwordInput.placeholder = "Enter a password"
        let checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.style.marginLeft = '7px'
        let btn = document.createElement('button')
        btn.style.marginLeft = '130px'
        btn.style.marginTop = '10px'
        btn.innerHTML = 'Log in'
        
        parent.append(loginForm)
        parent.append(passwordForm)
        parent.append(btnForm)
        loginForm.append(loginInput)
        passwordForm.append(passwordInput)
        passwordForm.append(checkbox)
        btnForm.append(btn)

        btn.onclick = () => {
            store.dispatch(actionFullLogin((loginInput.value),(passwordInput.value)))
        }
        function showOrHide() {
          if (checkbox.checked) {
            passwordInput.setAttribute('type' , 'text')
          } else {
            passwordInput.setAttribute('type','password')
          }
        }
        checkbox.addEventListener('change' , showOrHide)
        }
        let lfc = new LoginFormConstructor(main, true)
}

const actionFullLogin = (login , password) => async dispatch => {
    let result = await dispatch(actionPromise("login",log(login,password)))
    if (result.data.login !== null){
    dispatch(actionAuthLogin(result.data.login))
    logBtn.hidden = true
    regBtn.hidden = true
    main.innerHTML = ''
    let hLog = document.createElement('h1')
    hLog.innerHTML = "Вы успешно войшли в свой кабинет"
    hLog.style.textAlign = 'center'
    main.append(hLog)
    }
    else {
        alert ('Такого пользователя не существует или вы не правильно указали логин/пароль')
    }
}


actionFullRegister = (login,password) => async dispatch => {
    let result =  await dispatch (actionRegister(login,password))
    console.log(result)
    if (result.errors === undefined) {
        await dispatch (actionFullLogin(login,password))
        logBtn.hidden = true
        regBtn.hidden = true
        main.innerHTML = ""
        let hReg = document.createElement('h1')
        hReg.innerHTML = "Вы успешно зарегестрированы"
        hReg.style.textAlign = 'center'
        main.append(hReg)

    }
    else { 
        alert("Такой пользователь уже есть")

    }
}

if (localStorage.authToken) {
    regBtn.hidden = true
    logBtn.hidden = true
}

let newOrder = async(obj) => {
    let option = Object.entries(obj)
    let orderGoods = []
    for (let key of option) {
        let iteration = {
            "count": key[1].count,
            "good":{"_id":key[0]}
        }
        orderGoods.push(iteration)
    }
    let query = `mutation newOrder($order:OrderInput) {
        OrderUpsert(order:$order){
          _id
        }
      }`

      let qVariables = {
        "order": {
            "orderGoods": orderGoods}
      }
      
      let result = await shopGQL(query,qVariables)
      console.log(result)
      return result
}



actionOrder = (obj) => async dispatch => {
    return await dispatch (actionPromise ('order' , newOrder(obj)))
}



    function drawCart () {
        const cart = store.getState().cart
        if (cart) {
            main.innerHTML = ""
            let cartState = store.getState().cart
            for (key in cartState){
                let good = document.createElement('div')
                let goodName = document.createElement('h4')
                let goodImg = document.createElement('img')
                let btnPlus = document.createElement('button')
                let btnMinus = document.createElement('button')
                let countPriceGood = document.createElement('p')
                let goodA = document.createElement('a')
                let goodPrice = document.createElement('p')
                let goodCount = document.createElement('p')
                let btnDel = document.createElement('button')
                let input = document.createElement('input')
                input.placeholder = "Нужное количество товара"
                input.style.marginLeft = '10px'
                let btnInput = document.createElement('button')
                btnInput.innerHTML = 'Подтвердить'
                btnInput.style.marginLeft = '10px'
                btnInput.onclick = () => {
                    if (input.value > 1){
                        store.dispatch(actionCartChange(key , +input.value,cartState[key].price))
                    }
                }
                good.style.overflow = 'hidden'
                btnDel.style.float = 'right'
                goodImg.style.width = '100px'
                btnPlus.innerHTML = "+"
                btnPlus.style.marginLeft = '10px'
                btnPlus.onclick = () =>{
                    store.dispatch(actionCartChange(key,+(cartState[key].count) + 1,cartState[key].price))
                }
                btnMinus.innerHTML = "-"
                btnMinus.onclick = () => {
                    if (cartState[key].count > 1){
                        store.dispatch(actionCartChange(key , +(cartState[key].count) - 1,cartState[key].price))
                    }
                    else {
                        let question = confirm("Вы хотите удалить товар?")
                        if (question){
                            store.dispatch(actionCartRemove(key))
                            countBasket.innerHTML ="Товаров в корзине:" + " " + 0
                        }
                    
                    }
                }
                countPriceGood.style.fontWeight = 'bold'
                countPriceGood.hidden = true
                countPriceGood.style.marginTop = '20px'
                countPriceGood.style.textAlign = 'center'
                countPriceGood.style.float = 'right'
                btnDel.innerHTML = "Удалить товар"
                btnDel.onclick = () => {
                    let question = confirm("Вы хотите удалить товар?")
                    if (question){
                        store.dispatch(actionCartRemove(key))
                        
                    }
                }
                goodA.append(goodImg)
                goodA.href = '#/good/' + key
                if (cartState[key].count > 1) {
                    countPriceGood.removeAttribute('hidden' , 'hidden')
                    goodById(key).then(res => countPriceGood.innerHTML = "Общая цена товара:" + " " + (cartState[key].count) * res.data.GoodFindOne.price + "uah")
                }
                good.style.width = "50%"
                good.style.border = '2px solid black'
                good.style.marginTop = '20px'
                good.style.padding = '30px'
                goodById(key).then(res=> goodName.innerHTML = res.data.GoodFindOne.name)
                goodById(key).then(res=> goodImg.src = 'http://shop-roles.asmer.fs.a-level.com.ua/' +  res.data.GoodFindOne.images[0].url)
                goodById(key).then(res=>goodPrice.innerHTML = "Цена:" + " " + res.data.GoodFindOne.price + 'uah')
                goodCount.innerHTML = "Количество товара:" + " " + cartState[key].count
                goodById(key).then()
                good.style.marginLeft = '100px'
                good.append(goodName,goodA,goodPrice,goodCount,btnMinus,input,btnInput,btnPlus,btnDel)
                good.append(countPriceGood)
                var result = []
                result.push(cartState[key].count)
                var resId = []
                resId.push(cartState[key])
                let orderPrice = document.createElement("h5")
                orderPrice.style.float = 'right'
                main.append(good) 
                main.append(orderPrice)
            }
            if (Object.keys(cartState).length > 0){
            let orderPrice = document.createElement('h5')
            let res = []
            for (good in cartState) {
                    res.push((((cartState[good].price) * (cartState[good].count))))
                }
            orderPrice.innerHTML = "Цена заказа:" + " " +  res.reduce(function(a,b){
                    return a + b
                }) + 'uah'
            orderPrice.style.fontSize = '20px'
            orderPrice.style.float = 'right'
            orderPrice.style.marginRight = '500px'
            let btnBuy = document.createElement('button')
            btnBuy.innerHTML = 'Купить'
            btnBuy.style.float = 'right'
            btnBuy.style.marginRight = '500px'
            btnBuy.style.marginTop = '10px'
            btnBuy.onclick = () => {
                let obj = store.getState().cart
                for (key in obj){
                    store.dispatch(actionOrder(obj))
                }
                store.dispatch({type: 'CART_CLEAR'})
                countBasket.innerHTML ="Товаров в корзине:" + " " + 0
            }
            main.append(orderPrice)
            main.append(btnBuy)
           
            }
        }
    }

              
                
    
    store.subscribe(() => {
        const {1: route, 2:id} = location.hash.split('/')
        if (route === 'categories'){
            const catById = store.getState().promise.catById?.payload
            if (catById){
                main.innerText = ''
                let h = document.createElement('h2')
                h.style.fontSize = '30px'
                h.style.marginTop = 0
                h.innerHTML = catById.data.CategoryFindOne.name
                h.style.textAlign = 'center'
                main.append(h)
                //вывести циклом товары со ссылками вида #/good/АЙДИШНИК
                let goods = document.createElement('div')
                goods.className = 'goods'
                for (let key in catById.data.CategoryFindOne.goods) {
                    let box = document.createElement('div')
                    box.style.border = '3px solid #008B8B'
                    box.style.padding = '10px'
                    box.style.margin = '20px'
                    let img = document.createElement('img')
                    let productName = document.createElement('h3')
                    let a = document.createElement('a')
                    let price = document.createElement('p')
                    let description = document.createElement('p')
                    let btnMore = document.createElement('button')
                    btnMore.innerHTML = "Подробнее"
                    btnMore.style.backgroundColor = '#DCDCDC'
                    btnMore.style.display = 'block'
                    btnMore.style.marginLeft = 'auto'
                    btnMore.style.marginRight = 'auto' 
                    btnMore.style.marginTop = '20px'
                    img.src =  'http://shop-roles.asmer.fs.a-level.com.ua/' + catById.data.CategoryFindOne.goods[key].images[0].url
                    img.style.width = '300px'
                    img.style.display = 'block'
                    img.style.marginLeft = 'auto'
                    img.style.marginRight = 'auto'
                    a.href = '#/good/' + catById.data.CategoryFindOne.goods[key]._id
                    productName.innerHTML = catById.data.CategoryFindOne.goods[key].name + '<br/>'
                    price.innerHTML = "Цена:" + " " + catById.data.CategoryFindOne.goods[key].price + ' ' + 'uah'
                    price.style.fontWeight = 'bold'
                    a.style.textDecoration = 'none'
                    a.style.color = 'black'
                    description.innerHTML = catById.data.CategoryFindOne.goods[key].description
                    description.style.textAlign = 'center'
                    a.append(btnMore)
                    box.append(productName)
                    box.append(price)
                    box.append(img)
                    box.append(description)
                    box.append(a)
                    goods.append(box)
            }
            main.append(goods)
            //ПРИДУМАТЬ КНОПКИ ДОБАВЛЕНИЯ В КОРЗИНУ
            // main.innerHTML = `<pre>${JSON.stringify(catById, null ,4)}</pre>`
        }
    }
    if (route === 'good'){
        const goodById = store.getState().promise.goodById?.payload
        if (goodById){ //вывести в main страницу товара
            main.innerText = " "
            let source = goodById.data.GoodFindOne
            let product = document.createElement('div')
                let page = document.createElement('div')
                let h = document.createElement('h1')
                h.innerHTML = source.name
                h.style.textAlign = 'center'
                let img = document.createElement('img')
                img.src = 'http://shop-roles.asmer.fs.a-level.com.ua/' + source.images[0].url
                img.style.width = '300px'
                img.style.display = 'block'
                img.style.marginLeft = 'auto'
                img.style.marginRight = 'auto'
                let description = document.createElement('p')
                description.innerHTML = source.description
                description.style.textAlign = 'center'
                let price = document.createElement('p')
                price.innerHTML = 'Цена:' + " " + source.price + 'uah'
                price.textAlign = 'center'
                price.style.fontWeight = 'bold'
                let btnBuy = document.createElement('button')
                btnBuy.innerHTML = "Купить"
                btnBuy.style.backgroundColor = '#ADFF2F'
                btnBuy.style.display = 'block'
                btnBuy.style.marginLeft = 'auto'
                btnBuy.style.marginRight = 'auto'
                btnBuy.style.marginBottom = '10px'
                btnBuy.style.marginTop = '50px'
                btnBuy.style.width = '300px'
                btnBuy.style.fontSize = '20px'
                let btnAdd = document.createElement('button')
                btnAdd.innerHTML = "Добавить в корзину"
                btnAdd.style.backgroundColor = '#3CB371'
                btnAdd.style.display = 'block'
                btnAdd.style.marginLeft = 'auto'
                btnAdd.style.marginRight = 'auto'
                btnAdd.style.width = '300px'
                btnAdd.style.fontSize = '20px'
                btnAdd.onclick = () => {
                    store.dispatch(actionCartAdd(source._id,1 , source.name , source.price))
                }
                page.append(h)
                page.append(img)
                page.append(description)
                page.append(price)
                page.append(btnBuy)
                page.append(btnAdd)
                product.append(page)
                main.append(product)
                // console.log(actionCartAdd.count)
        }
        
    }
    if (route === 'cart')
   drawCart()
}
)
