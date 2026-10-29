#include <cassert>
#include <iostream>
#include "../../firmware/xiao/include/controller.h"
#include "../../firmware/xiao/include/bonded_access.h"
int main() {
  robo::Config cfg;cfg.actionsEnabled=cfg.credentialsConfigured=cfg.printerEnabled=true;
  robo::Controller c(cfg);robo::Command start;start.requestId="start";start.action="focus_start";start.hasDuration=true;start.durationMs=60000;
  assert(c.submit(start,100).ok);assert(c.focus().remaining(1100)==59000);
  assert(c.submit(start,2000).duplicate);assert(c.focus().remaining(2100)==58000);
  robo::Command pause;pause.requestId="pause";pause.action="focus_pause";
  assert(c.submit(pause,3100).ok);assert(c.focus().remaining(100000)==57000);
  pause.requestId="resume";pause.action="focus_resume";assert(c.submit(pause,101000).ok);
  c.tick(158000);assert(c.focus().phase()==robo::FocusSession::Completed);
  robo::FocusSession wrap;assert(wrap.apply("focus_start",60000,0xfffffff0));assert(wrap.remaining(0x10)==59968);
  start.requestId="invalid";start.durationMs=0;assert(!c.submit(start,159000).ok);
  robo::Command scene;scene.requestId="scene1";scene.action="print_scene";scene.hasOn=true;scene.on=true;scene.hasText=scene.hasEffect=true;
  scene.effect="checkin";scene.text="今天慢慢来也行";assert(c.submit(scene,160000).ok);c.finishPrint(scene.requestId,true);
  assert(c.submit(scene,160001).duplicate);scene.requestId="scene2";assert(c.submit(scene,160002).error=="scene_cooldown");
  scene.requestId="scene3";assert(c.submit(scene,460000).ok);c.finishPrint(scene.requestId,true);
  robo::Command mute;mute.requestId="mute";mute.action="auto_print";mute.hasOn=true;mute.on=false;assert(c.submit(mute,500000).ok);
  scene.requestId="scene4";scene.effect="rest";assert(c.submit(scene,500001).error=="auto_print_disabled");
  scene.requestId="manual";scene.on=false;assert(c.submit(scene,500002).ok);c.finishPrint(scene.requestId,true);
  scene.requestId="invalid-note";scene.text="bad|field";assert(!c.submit(scene,500003).ok);
  robo::BondedAccess gate;uint8_t a[6]={1,2,3,4,5,6},b[6]={6,5,4,3,2,1};
  assert(!gate.allowsConnection(0)); // No pointless PIN prompt outside enrollment.
  gate.connect(a);assert(!gate.authenticate(a,true,1));assert(!gate.open(1));gate.disconnect();
  assert(gate.open(0xfffffff0));assert(gate.enrolling(16));assert(gate.remaining(16)==119968);
  assert(gate.allowsConnection(16));gate.connect(a);assert(!gate.allowsConnection(16));
  assert(!gate.authenticate(b,true,16));assert(!gate.authenticate(a,false,16));assert(gate.authenticate(a,true,16));
  assert(gate.paired()&&gate.authorized());gate.disconnect();assert(!gate.authorized());
  assert(gate.allowsConnection(20)); // An admitted link is not an authenticated phone.
  gate.connect(b);assert(!gate.mayPair(20));assert(!gate.authenticate(b,true,20));gate.disconnect();
  gate.connect(a);assert(gate.mayPair(21));assert(gate.authenticate(a,true,21));
  robo::BondedAccess expired;assert(expired.open(1));expired.connect(a);assert(!expired.authenticate(a,true,120001));
  expired.disconnect();assert(!expired.allowsConnection(120001));assert(expired.remaining(120001)==0);
  assert(expired.open(120002));assert(expired.allowsConnection(120002));
  robo::BondedAccess restored;restored.restore(a);restored.connect(a);assert(restored.authenticate(a,true,0));
  std::cout<<"Companion timer, duplicate/automatic receipts, secure enrollment: passed\n";
}
