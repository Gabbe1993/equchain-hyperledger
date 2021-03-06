'use strict';

// add ett to market
function addToMarket(ett, transaction, market) {
    var marketEtt = false;
    var i;
    for (i = 0; i < market.etts.length; i++) {
        if (market.etts[i].toString().split("{")[1] === ett.toString().split("{")[1]) {
            marketEtt = true;
            break;
        }
    }
    if (marketEtt) {
        console.log("company already in market; increasing its ett");
        marketEtt.emission += transaction.emission;
    } else {
        console.log("pushed ett to market");
        market.etts.push(ett);
    }
    // increase emission of market
    market.emission += transaction.emission;
}

// remove ett from market
function removeFromMarket(ett, market) {
    var etts = market.etts;

    for(var i = 0; i < etts.length; i++) {
        if(etts[i].getIdentifier() === ett.ettID) {
            etts.splice(i, 1);
            console.log("Successfully removed from market: " + ett);
        }
    }
}


/**
 * API Transaction to declare ett to market
 *
 * @param {org.emission.network.Declare} transaction
 * @transaction
 */
function Declare(transaction) {
    return query('selectCompanyByID', {companyID: transaction.declarerID})
        .then(function (results) {

            var declarer = results[0];
            var emission = transaction.emission;
 

            return query('selectMarketByID', {marketID: declarer.marketID})
                .then(function (results) {
                    var market = results[0];

                  
                    // decrease emissionLimit from seller and give to his ett 
                    declarer.emissionConsumed += emission; 
		    market.declaredEmission += emission;   

                    return updateMarket(market)
                                .then(updateCompany(declarer))
                                
                        })
                        .then(function () {
                          // TradeEvent();
                        })
                })
        
}

/**
 * API Transaction to make a money deposit
 *
 * @param {org.emission.network.Deposit} transaction
 * @transaction
 */
function Deposit(transaction) {
    return query('selectCompanyByID', {companyID: transaction.deposerID})
        .then(function (results) {

            var deposer = results[0];
            var cash = transaction.cash;
 
            deposer.cash += cash;

            return updateCompany(deposer);                   
           
	})
        
}
/**
 * API Transaction to sell ett to market
 *
 * @param {org.emission.network.Sell} transaction
 * @transaction
 */
function Sell(transaction) {
    return query('selectCompanyByID', {companyID: transaction.sellerID})
        .then(function (results) {

            var seller = results[0];
            var emission = transaction.emission;
            var ettRef = seller.ett;

            return query('selectMarketByID', {marketID: seller.marketID})
                .then(function (results) {
                    var market = results[0];

                    // Check if seller has enough emission to sell
                    if (seller.emissionLimit < emission) {
                        throw "Cannot sell emission: Seller have " + seller.emissionLimit
                        + ". You are trying to sell " + emission;
                    }
                    // decrease emissionLimit from seller and give to his ett 
                    seller.emissionLimit -= emission;

                    return query('selectEttByID', {ettID: ettRef.getIdentifier()})
                        .then(function (results) {
                            var ett = results[0];
                            ett.emission += emission;
                            addToMarket(ett, transaction, market);
                            return ett;
                        })
                        .then(function (ett) {
                            return updateMarket(market)
                                .then(updateCompany(seller))
                                .then(updateEtt(ett))
                        })
                        .then(function () {
                          // TradeEvent();
                        })
                })
        })
}

/**
 * API Transaction to buy ett from market
 *
 * @param {org.emission.network.Buy} transaction
 * @transaction
 */
function Buy(transaction) {
    return query('selectCompanyByID', {companyID: transaction.buyerID})
        .then(function (results) {
            var buyer = results[0];

            return query('selectMarketByID', {marketID: buyer.marketID})
                .then(function (results) {
                    var market = results[0];

                    return buyFromMarket(buyer, market, transaction.emission);
                })
                .then(function () {
                    // TradeEvent();
                })
        })
}

function buyFromMarket(buyer, market, emission) {
    var promises = [], ett, etts = market.etts;

    if(emission > market.emission) {
        throw "Cannot buy emission: market have " + market.emission
            + ". You are trying to buy " + emission;
    }
    if((emission*10) > buyer.cash) {
        throw "Cannot buy emission: you have " + buyer.cash
            + "$. You need " + emission*10;
    }
    for (var i = 0; i < etts.length; i++) {
        if (emission >= 0) {
            var ettRef = etts[i];

            if (ettRef === undefined) {
                console.warn("Cannot buy emission: No more Ett in the market.");
                return;
            }
            promises.push(query('selectEttByID', {ettID: ettRef.getIdentifier()})
                .then(function (results) {
                    var ett = results[0];
                    var ettO = ett.owner;
                    promises.push(query('selectCompanyByID', {companyID: ettO.getIdentifier()})
			.then(function (results) {
			    var ettOwner = results[0];
		            emission -= updateEmissionFields(buyer, ett, ettOwner, market, emission);

		            promises.push(updateCompany(buyer));
			    promises.push(updateCompany(ettOwner));
		            promises.push(updateEtt(ett));
		            promises.push(updateMarket(market));
			}))
                }))

        }
    }
    // execute all promises
    return Promise.all(promises);
}


function updateEmissionFields(buyer, ett, ettOwner, market, emission) {
   
	    // sell maximum what's in the ett's emission   
	    if (ett.emission < emission) {
		emission = ett.emission;
	    }
	    buyer.emissionLimit += emission;
	    buyer.cash -= emission*10;	
	    ettOwner.cash += emission*10;
	    ett.emission -= emission;
	    market.emission -= emission;

	    console.log(buyer.name + " emission level set to " + buyer.emissionLimit);

	    // if all emission is bought then this Ett should be removed from market
	    if (ett.emission <= 0) {
		removeFromMarket(ett, market);
	    }

	    return emission; 
}


function TradeEvent(transaction) {
    var factory = getFactory();

    var event = factory.newEvent('org.emission.network', 'TradeEvent');

    event.sellerID = transaction.seller.companyID;
    event.buyerID = transaction.buyer.companyID;
    event.market = transaction.market;
    event.message = "Trade: " + event.sellerID + " -> " + event.buyerID;

    emit(event);
}

/**
 * Remove company and withdraw its ett from market 
 * @param {org.emission.network.RemoveCompany} transaction
 * @transaction
 */
function RemoveCompany(transaction) {
    var companyID = transaction.companyID;

    return query('selectCompanyByID', {companyID: companyID})
        .then(function (results) {
            var company = results[0];

            return query('selectMarketByID', {marketID: company.marketID})
                .then(function (results) {
                    var market = results[0];
                    var ett;

                    return query('selectEttByID', {ettID: company.ett.getIdentifier()})
                    .then(function (results) {
                         ett = results[0];
                
                        return Promise.resolve(updateEmissionFields(company, ett, company, market, ett.emission))
                            .then(updateMarket(market))
                            .then(removeAsset(ett, 'Ett'))
                            .then(removeParticipant(company, 'Company'))
                    })
                })
            })
}

/**
 * Refresh event 
 * @param {org.emission.network.Refresh} concept
 * @transaction
 */
function Refresh(concept) {
    var res = {
        sellerID: undefined,
        buyerID: undefined,
        market: undefined
    }

    query('selectMarketByID', {marketID: marketID})
        .then(function (results) {
            res.market = results[0];
        })
        .then(function() {
            query('selectCompanyByID', {companyID: buyerID})
            .then(function (results) {
                res.buyer = results[0];
            })
        })
        .then(function() {
            query('selectCompanyByID', {companyID: sellerID})
            .then(function (results) {
                res.seller = results[0];
            })
        })
        .then(function () {
            console.log("returning: " + res);
            return res;
        });
}


/**
 * ChangeEttOwner transaction
 * @param {org.emission.network.ChangeEttOwner} Transaction
 * @transaction
 */
function ChangeEttOwner(transaction) {
    var ett = transaction.ett;
    var prevOwner = ett.owner;

    // undefine previous owner of ett if one exists
    if (prevOwner !== undefined && prevOwner.ett !== undefined) {
        ett.owner.ett = undefined;
    }
    var newOwner = transaction.newOwner;

    // set owner of ett to new owner 
    ett.owner = newOwner;

    // update asset registriy
    return updateEtt(ett)
        .then(function () {
            if (prevOwner !== undefined) {
                updateCompanies(newOwner, prevOwner);
            } else {
                updateCompany(newOwner);
            }
        });
}

// Remove asset from registry
function removeAsset(asset, registryName) {
    return getAssetRegistry('org.emission.network.' + registryName)
        .then(function (registry) {
            console.log("removed asset: " + asset);

            return registry.remove(asset)
        })
}

// Remove participant from registry
function removeParticipant(participant, registryName) {
    return getParticipantRegistry('org.emission.network.' + registryName)
        .then(function (registry) {
            console.log("removed participant: " + participant);

            return registry.remove(participant)
        })
}

function updateMarket(market) {
    return getAssetRegistry('org.emission.network.Market')
        .then(function (registry) {
            console.log("update Market #" + market);

            return registry.update(market)
        })
}

function updateCompany(company) {
    return getParticipantRegistry('org.emission.network.Company')
        .then(function (registry) {
            console.log("update Company #" + company);

            return registry.update(company);
        })
}

function updateEtts(etts) {
    return getAssetRegistry('org.emission.network.Ett')
        .then(function (registry) {
            console.log("update Ett #" + etts);

            return registry.updateAll(etts);
        })
}

function updateEtt(ett) {
    return getAssetRegistry('org.emission.network.Ett')
        .then(function (registry) {
            console.log("update Ett #" + ett);

            return registry.update(ett);
        })
}

function updateCompanies(buyer, seller) {
    return getParticipantRegistry('org.emission.network.Company')
        .then(function (registry) {
            console.log("update Companies #" + [buyer.companyID, seller.companyID]);

            return registry.updateAll([buyer, seller]);
        })
}
