// Use broker server for P2P connect via node names
// > ampbroker verbose:1

// Register this node 
port(DIR.IP('*'),{proto:'udp',multicast:true, name:'/domain1/A',broker:env.broker||'127.0.0.1:10001',verbose:1});
lookup(DIR.PATH('/domain1/*'),function (result) {
  log('lookup: '+result)
});
