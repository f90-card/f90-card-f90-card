(function(){
"use strict";
const NAMES={ar:"العربية",en:"English",fr:"Français",pt:"Português"};
const TABLE={"الرئيسية":["Home","Accueil","Início"],"الأقسام":["Categories","Catégories","Categorias"],"المنتجات":["Products","Produits","Produtos"],"البحث":["Search","Rechercher","Pesquisar"],"بحث":["Search","Rechercher","Pesquisar"],"ابحث عن خدمة":["Search for a service","Rechercher un service","Pesquisar um serviço"],"ما الخدمة التي تبحث عنها؟":["What service are you looking for?","Quel service recherchez-vous ?","Qual serviço você procura?"],"القائمة":["Menu","Menu","Menu"],"المحفظة":["Wallet","Portefeuille","Carteira"],"رصيدي":["My balance","Mon solde","Meu saldo"],"الإيداع":["Deposit","Dépôt","Depósito"],"تعبئة الرصيد":["Add balance","Recharger le solde","Adicionar saldo"],"شراء":["Buy","Acheter","Comprar"],"شراء الآن":["Buy now","Acheter maintenant","Comprar agora"],"إتمام الطلب":["Place order","Passer commande","Finalizar pedido"],"تأكيد الطلب":["Confirm order","Confirmer la commande","Confirmar pedido"],"إلغاء":["Cancel","Annuler","Cancelar"],"تأكيد":["Confirm","Confirmer","Confirmar"],"عودة":["Back","Retour","Voltar"],"رجوع":["Back","Retour","Voltar"],"حفظ":["Save","Enregistrer","Salvar"],"متابعة":["Continue","Continuer","Continuar"],"التالي":["Next","Suivant","Próximo"],"السابق":["Previous","Précédent","Anterior"],"عرض الكل":["View all","Tout voir","Ver tudo"],"عرض المزيد":["Show more","Afficher plus","Mostrar mais"],"التفاصيل":["Details","Détails","Detalhes"],"السعر":["Price","Prix","Preço"],"الكمية":["Quantity","Quantité","Quantidade"],"الإجمالي":["Total","Total","Total"],"الرصيد":["Balance","Solde","Saldo"],"الدولار":["US dollar","Dollar américain","Dólar americano"],"شيقل":["Shekel","Shekel","Shekel"],"دينار":["Dinar","Dinar","Dinar"],"الاسم":["Name","Nom","Nome"],"البريد الإلكتروني":["Email","E-mail","E-mail"],"كلمة المرور":["Password","Mot de passe","Senha"],"رقم الهاتف":["Phone number","Numéro de téléphone","Número de telefone"],"تسجيل الدخول":["Sign in","Connexion","Entrar"],"تسجيل الخروج":["Sign out","Déconnexion","Sair"],"إنشاء حساب":["Create account","Créer un compte","Criar conta"],"حسابي":["My account","Mon compte","Minha conta"],"الملف الشخصي":["Profile","Profil","Perfil"],"الإعدادات":["Settings","Paramètres","Configurações"],"التوثيق":["Verification","Vérification","Verificação"],"توثيق الحساب":["Verify account","Vérifier le compte","Verificar conta"],"الطلبات":["Orders","Commandes","Pedidos"],"طلباتي":["My orders","Mes commandes","Meus pedidos"],"سجل الطلبات":["Order history","Historique des commandes","Histórico de pedidos"],"سجل العمليات":["Transaction history","Historique des transactions","Histórico de transações"],"قيد الانتظار":["Pending","En attente","Pendente"],"قيد المعالجة":["Processing","En cours","Processando"],"مكتمل":["Completed","Terminé","Concluído"],"مرفوض":["Rejected","Refusé","Rejeitado"],"تم الإلغاء":["Cancelled","Annulé","Cancelado"],"الإشعارات":["Notifications","Notifications","Notificações"],"الأخبار والإشعارات":["News and notifications","Actualités et notifications","Notícias e notificações"],"شحن التطبيقات":["App top-ups","Recharges d'applications","Recarga de aplicativos"],"بطاقات رقمية":["Digital cards","Cartes numériques","Cartões digitais"],"البطاقات الرقمية":["Digital cards","Cartes numériques","Cartões digitais"],"خدمات السوشيال ميديا":["Social media services","Services de réseaux sociaux","Serviços de redes sociais"],"تحويل الأموال":["Money transfer","Transfert d'argent","Transferência de dinheiro"],"طرق الدفع":["Payment methods","Moyens de paiement","Formas de pagamento"],"طرق الإيداع":["Deposit methods","Méthodes de dépôt","Métodos de depósito"],"اختر طريقة الدفع":["Choose payment method","Choisir un moyen de paiement","Escolha a forma de pagamento"],"التواصل معنا":["Contact us","Contactez-nous","Fale conosco"],"الدعم الفني":["Support","Assistance","Suporte"],"المساعدة":["Help","Aide","Ajuda"],"معلومات عنا":["About us","À propos","Sobre nós"],"تعرف على F90":["About F90","Découvrir F90","Conheça a F90"],"سياسة الخصوصية":["Privacy policy","Politique de confidentialité","Política de privacidade"],"الشروط والأحكام":["Terms and conditions","Conditions générales","Termos e condições"],"اللغة":["Language","Langue","Idioma"],"اختر اللغة":["Choose language","Choisir la langue","Escolha o idioma"],"تغيير اللغة":["Change language","Changer la langue","Alterar idioma"],"العملة":["Currency","Devise","Moeda"],"العملات":["Currencies","Devises","Moedas"],"الرقم التعريفي":["Account ID","Identifiant du compte","ID da conta"],"معرف الحساب":["Account ID","Identifiant du compte","ID da conta"],"لا توجد نتائج":["No results","Aucun résultat","Nenhum resultado"],"حدث خطأ":["An error occurred","Une erreur s'est produite","Ocorreu um erro"],"إعادة المحاولة":["Try again","Réessayer","Tentar novamente"],"جارٍ التحميل":["Loading","Chargement","Carregando"],"الرجاء الانتظار":["Please wait","Veuillez patienter","Aguarde"],"تثبيت التطبيق":["Install app","Installer l'application","Instalar aplicativo"],"الصفحة الرئيسية":["Home page","Page d'accueil","Página inicial"],"بحث عن المنتجات":["Search products","Rechercher des produits","Pesquisar produtos"],"جميع الخدمات":["All services","Tous les services","Todos os serviços"],"أحدث الخدمات":["Latest services","Derniers services","Serviços recentes"],"خدماتنا":["Our services","Nos services","Nossos serviços"]};
Object.assign(TABLE,{"إضافة إلى السلة":["Add to cart","Ajouter au panier","Adicionar ao carrinho"],"سلة المشتريات":["Shopping cart","Panier","Carrinho"],"الدفع":["Payment","Paiement","Pagamento"],"ادفع الآن":["Pay now","Payer maintenant","Pagar agora"],"تم بنجاح":["Successful","Terminé avec succès","Concluído com sucesso"],"فشل الطلب":["Order failed","Commande échouée","Pedido falhou"],"اسم المستخدم":["Username","Nom d'utilisateur","Nome de usuário"],"تأكيد كلمة المرور":["Confirm password","Confirmer le mot de passe","Confirme a senha"],"نسيت كلمة المرور؟":["Forgot password?","Mot de passe oublié ?","Esqueceu a senha?"],"استعادة كلمة المرور":["Reset password","Réinitialiser le mot de passe","Redefinir senha"],"أدخل المبلغ":["Enter amount","Saisir le montant","Digite o valor"],"أدخل الكمية":["Enter quantity","Saisir la quantité","Digite a quantidade"],"رقم الطلب":["Order number","Numéro de commande","Número do pedido"],"حالة الطلب":["Order status","Statut de la commande","Status do pedido"],"المبلغ":["Amount","Montant","Valor"],"المبلغ الإجمالي":["Total amount","Montant total","Valor total"],"صافي المبلغ":["Net amount","Montant net","Valor líquido"],"العمولة":["Fee","Commission","Taxa"],"جاري المعالجة":["Processing","Traitement en cours","Processando"],"تم الشحن":["Top-up completed","Recharge effectuée","Recarga concluída"],"جارٍ التحميل…":["Loading…","Chargement…","Carregando…"],"عرض التفاصيل":["View details","Voir les détails","Ver detalhes"],"الصفحة غير موجودة":["Page not found","Page introuvable","Página não encontrada"],"لا توجد خدمات":["No services available","Aucun service disponible","Nenhum serviço disponível"],"لا توجد منتجات":["No products available","Aucun produit disponible","Nenhum produto disponível"],"اختر القسم":["Choose category","Choisir une catégorie","Escolha uma categoria"],"جميع الأقسام":["All categories","Toutes les catégories","Todas as categorias"],"الأقسام الفرعية":["Subcategories","Sous-catégories","Subcategorias"],"حفظ التغييرات":["Save changes","Enregistrer les modifications","Salvar alterações"],"تعديل":["Edit","Modifier","Editar"],"حذف":["Delete","Supprimer","Excluir"],"إضافة":["Add","Ajouter","Adicionar"],"إرسال":["Send","Envoyer","Enviar"],"نسخ":["Copy","Copier","Copiar"],"تم النسخ":["Copied","Copié","Copiado"],"تحديث":["Refresh","Actualiser","Atualizar"],"الحالة":["Status","Statut","Status"],"نشط":["Active","Actif","Ativo"],"متوقف":["Inactive","Inactif","Inativo"],"متوفر":["Available","Disponible","Disponível"],"غير متوفر":["Unavailable","Indisponible","Indisponível"],"نفدت الكمية":["Out of stock","Rupture de stock","Esgotado"],"قيد التعبئة":["Restocking","Réapprovisionnement","Reabastecendo"],"الحد الأدنى":["Minimum","Minimum","Mínimo"],"الحد الأقصى":["Maximum","Maximum","Máximo"],"الحد الأدنى للكمية":["Minimum quantity","Quantité minimale","Quantidade mínima"],"الحد الأقصى للكمية":["Maximum quantity","Quantité maximale","Quantidade máxima"],"اختيار":["Select","Sélectionner","Selecionar"],"اختر":["Choose","Choisir","Escolher"],"الطلبات السابقة":["Previous orders","Commandes précédentes","Pedidos anteriores"],"خدمات التطبيقات":["App services","Services d'applications","Serviços de aplicativos"],"شحن الألعاب":["Game top-ups","Recharges de jeux","Recarga de jogos"],"سحب الرواتب":["Salary withdrawal","Retrait des salaires","Saque de salários"],"شراء مكاسب ألعاب":["Buy game earnings","Acheter des gains de jeux","Comprar ganhos de jogos"],"سحب تارجت":["Target withdrawal","Retrait Target","Saque Target"],"بيع الحسابات":["Sell accounts","Vendre des comptes","Vender contas"],"رسائلي":["My messages","Mes messages","Minhas mensagens"],"الرسائل":["Messages","Messages","Mensagens"],"أرسل رسالة":["Send a message","Envoyer un message","Enviar mensagem"],"مركز المساعدة":["Help center","Centre d'aide","Central de ajuda"],"اتصل بنا":["Contact us","Contactez-nous","Entre em contato"],"واتساب":["WhatsApp","WhatsApp","WhatsApp"],"الرابط":["Link","Lien","Link"],"لوحة التحكم":["Dashboard","Tableau de bord","Painel de controle"],"لوحة الإدارة":["Admin panel","Panneau d'administration","Painel administrativo"],"العملاء":["Customers","Clients","Clientes"],"اسم الخدمة":["Service name","Nom du service","Nome do serviço"],"وصف الخدمة":["Service description","Description du service","Descrição do serviço"],"معلومات الخدمة":["Service information","Informations sur le service","Informações do serviço"],"الدولة":["Country","Pays","País"],"المدينة":["City","Ville","Cidade"],"العنوان":["Address","Adresse","Endereço"],"رقم الحساب":["Account number","Numéro de compte","Número da conta"],"الدفع عند الاستلام":["Cash on delivery","Paiement à la livraison","Pagamento na entrega"],"معلومات الدفع":["Payment information","Informations de paiement","Informações de pagamento"],"سجل الإيداعات":["Deposit history","Historique des dépôts","Histórico de depósitos"],"طرق التحويل":["Transfer methods","Méthodes de transfert","Métodos de transferência"],"عملة الحساب":["Account currency","Devise du compte","Moeda da conta"],"استمرار":["Continue","Continuer","Continuar"],"ابدأ الآن":["Get started","Commencer","Começar agora"],"تسجيل":["Register","S'inscrire","Cadastrar"],"تم التحقق":["Verified","Vérifié","Verificado"],"غير موثق":["Not verified","Non vérifié","Não verificado"],"تم التوثيق":["Verified","Vérifié","Verificado"],"مراجعة":["Review","Examiner","Revisar"],"تم الرفض":["Rejected","Refusé","Rejeitado"]});
const translation=new Map(Object.entries(TABLE));
const supported=Object.keys(NAMES);
const choiceKey="f90-language";
function deviceLanguage(){const raw=(navigator.languages&&navigator.languages[0])||navigator.language||"ar";return supported.includes(raw.toLowerCase().split("-")[0])?raw.toLowerCase().split("-")[0]:"ar";}
function savedLanguage(){try{const v=localStorage.getItem(choiceKey);return supported.includes(v)?v:null;}catch{return null;}}
let lang=savedLanguage()||deviceLanguage();
const CATALOG_WORDS={"شحن":["Top-up","Recharge","Recarga"],"سحب":["Withdrawal","Retrait","Saque"],"خدمة":["Service","Service","Serviço"],"اشتراك":["Subscription","Abonnement","Assinatura"],"اشتراكات":["Subscriptions","Abonnements","Assinaturas"],"بطاقة":["Card","Carte","Cartão"],"بطاقات":["Cards","Cartes","Cartões"],"كوينز":["Coins","Pièces","Moedas"],"كوين":["Coin","Pièce","Moeda"],"شهري":["Monthly","Mensuel","Mensal"],"سنوي":["Yearly","Annuel","Anual"],"يومي":["Daily","Quotidien","Diário"],"اسبوعي":["Weekly","Hebdomadaire","Semanal"],"أسبوعي":["Weekly","Hebdomadaire","Semanal"],"متابعين":["Followers","Abonnés","Seguidores"],"متابع":["Follower","Abonné","Seguidor"],"مشاهدات":["Views","Vues","Visualizações"],"مشاهدة":["View","Vue","Visualização"],"إعجابات":["Likes","J'aime","Curtidas"],"لايكات":["Likes","J'aime","Curtidas"],"تعليقات":["Comments","Commentaires","Comentários"],"مشاركة":["Share","Partage","Compartilhamento"],"مليون":["Million","Million","Milhão"],"الف":["Thousand","Mille","Mil"],"ألف":["Thousand","Mille","Mil"],"نقاط":["Points","Points","Pontos"],"رصيد":["Balance","Solde","Saldo"],"دولار":["USD","USD","USD"],"دينار":["Dinar","Dinar","Dinar"],"شيقل":["Shekel","Shekel","Shekel"],"شيكل":["Shekel","Shekel","Shekel"],"الاردن":["Jordan","Jordanie","Jordânia"],"الأردن":["Jordan","Jordanie","Jordânia"],"فلسطين":["Palestine","Palestine","Palestina"],"سوريا":["Syria","Syrie","Síria"],"لبنان":["Lebanon","Liban","Líbano"],"تركيا":["Turkey","Turquie","Turquia"],"مصر":["Egypt","Égypte","Egito"],"العراق":["Iraq","Irak","Iraque"],"المغرب":["Morocco","Maroc","Marrocos"],"اليمن":["Yemen","Yémen","Iêmen"],"الجزائر":["Algeria","Algérie","Argélia"],"أمريكا":["United States","États-Unis","Estados Unidos"],"حساب":["Account","Compte","Conta"],"حسابات":["Accounts","Comptes","Contas"],"مكاسب":["Earnings","Gains","Ganhos"],"العاب":["Games","Jeux","Jogos"],"ألعاب":["Games","Jeux","Jogos"],"شحن سريع":["Fast top-up","Recharge rapide","Recarga rápida"],"فوري":["Instant","Instantané","Instantâneo"],"تفعيل":["Activation","Activation","Ativação"],"هدية":["Gift","Cadeau","Presente"],"تارجت":["Target","Target","Target"],"اكزينا":["Xena","Xena","Xena"],"أكزينا":["Xena","Xena","Xena"],"عبر":["via","via","via"],"بواسطة":["via","via","via"],"تلقائي":["Automatic","Automatique","Automático"],"يدوي":["Manual","Manuel","Manual"]};
const arabicPattern=/[\u0600-\u06FF]/;
const tokenPattern=/[\u0621-\u064A]+/g;
function catalogFallback(value){
 if(lang==="ar" || !arabicPattern.test(value))return value;
 const index={en:0,fr:1,pt:2}[lang];
 let replaced=0;
 const output=value.replace(tokenPattern,token=>{
   const translated=CATALOG_WORDS[token];
   if(translated){replaced++;return translated[index];}
   return token;
 });
 // Keep unrecognized brand names and numbers intact, never invent a translation.
 return replaced?output:value;
}
const original=new WeakMap();
const last=new WeakMap();
function convert(value){const match=/^(\s*)(.*?)(\s*)$/s.exec(value||"");if(!match)return value;const val=translation.get(match[2]);if(lang==="ar")return value;if(!val)return catalogFallback(value);const index={en:0,fr:1,pt:2}[lang];return match[1]+val[index]+match[3];}
function isExcluded(el){return !!el.closest('script,style,code,pre,textarea,[contenteditable="true"],[data-f90-no-translate]');}
function textNode(node){
 const el=node.parentElement;if(!el||isExcluded(el))return;
 const now=node.nodeValue||"";
 let src=original.get(node);
 if(src===undefined){src=now;original.set(node,src);}
 else if(last.has(node)&&now!==last.get(node)&&now!==src){src=now;original.set(node,src);}
 const next=convert(src);
 if(next!==now)node.nodeValue=next;
 last.set(node,next);
}
const attributeNames=["placeholder","title","aria-label","alt"];
const originalAttrs=new WeakMap();
const translatedAttrs=new WeakMap();
function attributes(el){
 let src=originalAttrs.get(el);if(!src){src={};originalAttrs.set(el,src);}
 let rendered=translatedAttrs.get(el);if(!rendered){rendered={};translatedAttrs.set(el,rendered);}
 for(const key of attributeNames){
  if(!el.hasAttribute(key))continue;
  const current=el.getAttribute(key)||"";
  if(!(key in src)||(key in rendered&&current!==rendered[key]&&current!==src[key]))src[key]=current;
  const next=convert(src[key]);
  if(next!==current)el.setAttribute(key,next);
  rendered[key]=next;
 }
}
function translateTree(root){
 if(root.nodeType===3){textNode(root);return;}
 if(root.nodeType!==1||isExcluded(root))return;
 attributes(root);
 const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walk.nextNode())textNode(walk.currentNode);
 root.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach(attributes);
}
let isRunning=false, pending=false;
function scan(){
 if(isRunning||!document.body)return;
 isRunning=true;
 try{translateTree(document.body);document.title=convert(titleOriginal);}
 finally{isRunning=false;}
}
const titleOriginal=document.title;
function setLanguage(next,save){
 if(!supported.includes(next))next="ar";
 lang=next;
 document.documentElement.lang=next;
 document.documentElement.dir=next==="ar"?"rtl":"ltr";
 document.documentElement.dataset.f90Language=next;
 if(save)try{localStorage.setItem(choiceKey,next);}catch{}
 for(const id of ["f90-language-select","f90-language-drawer"]){const input=document.getElementById(id);if(input)input.value=next;}
 scan();
 window.dispatchEvent(new CustomEvent("f90:languagechange",{detail:{language:next}}));
}
function makePicker(id){
 const holder=document.createElement("label");holder.className="f90-language-picker";holder.dataset.f90NoTranslate="true";
 holder.textContent="🌐 ";
 const select=document.createElement("select");select.id=id;select.setAttribute("aria-label","Choose website language");
 for(const [key,name] of Object.entries(NAMES)){const option=document.createElement("option");option.value=key;option.textContent=name;select.appendChild(option);}
 select.value=lang;select.addEventListener("change",()=>setLanguage(select.value,true));holder.appendChild(select);return holder;
}
function addControl(){
 const toolbar=document.querySelector(".header-actions")||document.querySelector(".admin-top");
 if(toolbar&&!document.getElementById("f90-language-select")){
  const control=makePicker("f90-language-select");control.id="f90-language-control";
  if(document.querySelector(".admin-top-title"))document.querySelector(".admin-top-title").insertAdjacentElement("afterend",control);
  else {const admin=document.getElementById("f90AdminShortcut");const menu=document.getElementById("menuButton");if(menu)menu.after(control);else toolbar.appendChild(control);}
 }
 const drawer=document.querySelector(".drawer-preferences")||document.querySelector("#adminSidebar");
 if(drawer&&!document.getElementById("f90-language-drawer")){
  const control=makePicker("f90-language-drawer");control.id="f90-language-drawer-control";
  drawer.prepend(control);
 }
}
function bootstrap(){addControl();setLanguage(lang,false);const observer=new MutationObserver(records=>{if(pending||isRunning)return;let meaningful=false;for(const m of records){if(m.type==="childList"&&m.addedNodes.length){meaningful=true;break;}if(m.type==="characterData"&&m.target.nodeValue!==last.get(m.target)){meaningful=true;break;}if(m.type==="attributes"){const originals=originalAttrs.get(m.target);const translated=translatedAttrs.get(m.target);if(!translated||m.target.getAttribute(m.attributeName)!==translated[m.attributeName]){meaningful=true;break;}}}if(!meaningful)return;pending=true;requestAnimationFrame(()=>{pending=false;observer.disconnect();try{scan();}finally{observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attributeNames});}});});observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attributeNames});window.F90Language={get:()=>lang,set:(l)=>setLanguage(l,true),translate:convert,supported:[...supported]};}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootstrap,{once:true});else bootstrap();
})();
