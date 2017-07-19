describe("integration tests", function () {

  // We need to wait for a ledger to close

  const TIMEOUT = 20*100000000;

  this.timeout(TIMEOUT);

  this.slow(TIMEOUT/2);



  StellarSdk.Network.useTestNetwork();



  // Docker

  let server = new StellarSdk.Server('http://127.0.0.1:8000', {allowHttp: true});

  //let server = new StellarSdk.Server('http://192.168.59.103:32773', {allowHttp: true});
  var myAccountA = StellarSdk.Keypair.random();
  var myAccountB = StellarSdk.Keypair.random();
  var myAliasB = StellarSdk.Keypair.random().publicKey();
  let master = StellarSdk.Keypair.master();
  var masterSource = master.secret();
  var sourceKeys = StellarSdk.Keypair.fromSecret(masterSource);
  before(function(done) {

    this.timeout(60*1000);

    checkConnection(done);

  });



  function checkConnection(done) {

    server.loadAccount(master.publicKey())

      .then(source => {

        console.log('Horizon up and running!');

        done();

      })

      .catch(err => {

        console.log("Couldn't connect to Horizon... Trying again.");

        setTimeout(() => checkConnection(done), 2000);

      });
  }



/*

  function createNewAccountTest(accountId) {

    server.loadAccount(master.publicKey())

      .then(source => {

        let tx = new StellarSdk.TransactionBuilder(source)

          .addOperation(StellarSdk.Operation.createAccount({

            destination: accountId,

            startingBalance: "20"

          }))

          .build();



        tx.sign(master);

      });//var resTransaction = server.submitTransaction(tx);

  }


var accountSecret = StellarSdk.Keypair.random();
*/
  function createNewAccount(accountId) {
    return server.loadAccount(master.publicKey())
      .then(source => {
        let tx = new StellarSdk.TransactionBuilder(source)
          .addOperation(StellarSdk.Operation.createAccount({
            destination: accountId,
            startingBalance: "100000000"
          }))
          .build();

        tx.sign(master);
        return server.submitTransaction(tx);
      });
  }

  function ManagerAlias(aliasID, accountID, secretKeyAccount, isDel){
    return server.loadAccount(accountID).
      then(source => {
        let tx = new StellarSdk.TransactionBuilder(source)
        .addOperation(StellarSdk.Operation.manageAlias({
          aliasId: aliasID,
          isDelete: isDel
        }))
        .build();
        tx.sign(secretKeyAccount);
        return server.submitTransaction(tx);
      });
  }

  function CreatePayment(dest, amount, sourceAccount ,secretKeyAccount){
    var transaction = new StellarSdk.TransactionBuilder(sourceAccount)
              .addOperation(StellarSdk.Operation.payment({
                  destination: dest,
                  asset: StellarSdk.Asset.native(),
                  amount: amount
              }))
              .build();
          transaction.sign(secretKeyAccount);
      return server.submitTransaction(transaction);
  }

  describe("/transaction", function () {

    it("submits a new transaction (Create AccountA)", function (done) {
      var res = myAccountA.publicKey();
      createNewAccount(res)
        .then(result => {
          expect(result.ledger).to.be.not.null;
          done();
        })
        .catch(err => done(err));
    });


    it("submits a new transaction (Create AccountB)", function (done) {
      var res = myAccountB.publicKey();
      createNewAccount(res)
        .then(result => {
          expect(result.ledger).to.be.not.null;
          done();
        })
        .catch(err => done(err));
    });


    it("submits a new transaction (createAlias)", function (done) {
      var accountid = myAccountB.publicKey();
      ManagerAlias(myAliasB, accountid, myAccountB ,false)
        .then(result => {
          expect(result.ledger).to.be.not.null;
          done();
        })
        .catch(err => done(err));
        console.log("AliasID: ");
        console.log(myAliasB);
        console.log("AccountB_ID: ");
        console.log(accountid);
    });

    it("submits a new payment with alias", function(done){
      server.loadAccount(myAccountA.publicKey())
      .catch(StellarSdk.NotFoundError, function (error) {
          throw new Error('The destination account does not exist!');
      })
      .then(function() {
          return server.loadAccount(myAccountA.publicKey());
      })
      .then(function(sourceAccount) {
          return CreatePayment(myAliasB, "1000", sourceAccount, myAccountA);
      })
      .then(function(result) {
          console.log('Success!');
          expect(result.ledger).to.be.not.null;
          done();
      })
      .catch(function(error) {
          console.error('Something went wrong!', error);
      });
    });

    it("submits a delete alias", function(done){
      var accountid = myAccountB.publicKey();
      ManagerAlias(myAliasB, accountid, myAccountB , true)
        .then(result => {
          console.log('Success!');
          expect(result.ledger).to.be.not.null;
          done();
        })
        .catch(function(error) {
          console.error('Something went wrong!', error);
      });
    });

    it("submits a createAlias with reserve AccountID (error)", function(done){
      var accountid = myAccountB.publicKey();
      var pubIdAccountA = myAccountA.publicKey()
      ManagerAlias(pubIdAccountA, accountid, myAccountB ,false)
        .then(result => {
          expect(result.ledger).to.be.not.null;
          done(new Error("This promise should be rejected."));
        })
        .catch(err =>{
          done();
          console.log("Success! Create alias failed, id with account already exist.");
        });
    });

    it("sibmits a delete alias not owner account (error)", function(done){
      var tmpAlias = StellarSdk.Keypair.random().publicKey();
      var pubKeyAccountA = myAccountA.publicKey();
      var pubKeyAccountB = myAccountB.publicKey();
      ManagerAlias(tmpAlias, pubKeyAccountA, myAccountA , false)
        .then(result => {
          console.log('Success! Create alias for accountA');
          expect(result.ledger).to.be.not.null;
        })
        .catch(function(error) {
          console.error('Something went wrong!', error);
      });

      ManagerAlias(tmpAlias, pubKeyAccountB, myAccountB , true)
        .then(result => {
          done(new Error("This promise should be rejected!"));
        })
        .catch(function(error) {
          done();
          console.error("Success! AccountB cannot delete alias accountA.");
      });  
    });

    it("sibmits a AccountA try to create alias for AccountB (error)", function(done){
      var tmpAlias = StellarSdk.Keypair.random().publicKey();
      var pubKeyAccountA = myAccountA.publicKey();
      var pubKeyAccountB = myAccountB.publicKey();
      ManagerAlias(tmpAlias, pubKeyAccountB, myAccountA , false)
        .then(result => {
          done(new Error('Error! AccountA created alias for AccountB!'));
          expect(result.ledger).to.be.not.null;
        })
        .catch(function(error) {
          done();
          console.log("AccountA cannot create alias for AccountB.");
      });
    });

    

  });

});