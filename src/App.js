import "./App.css";
// import { Notifications } from "react-push-notification";
import { Button, Col, Input, Row, Radio, Select, Checkbox, Tabs } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import React from "react";
import CowinApi from "./models";

import moment from "moment";

const { TabPane } = Tabs;
const cowinApi = new CowinApi();
const { Search } = Input;
const { Option } = Select;

class App extends React.Component{
  constructor(props) {
    super(props);
    // if(localStorage.appData){
    //   this.state = Object.assign({}, JSON.parse(localStorage.appData))
    // }else{
      this.state = {
        isWatchingAvailability: false,
        isAuthenticated: localStorage.token ? true : false,
        minAge: 18,
        districId: 265,
        stateId: 16,
        beneficiaries: [],
        selectedBeneficiaries: [],
        otpData: {
          txnId: `df92a06c-27dd-4d80-b9c0-95251edc7da9`
        },
        vaccineCalendar: {},
        zip: null,
        enableOtp: false,
        otp: 480604,
        mobile: 9701899909,
        token: localStorage.token || null,
        selectedTab: "1",
        dates: [],
        states: [],
        districs: []

      };
    // }
  }
  async waitForOtp(){

    console.log('waiting for otp');
    if(this.ac){
      this.ac.abort();
    }
    if ('OTPCredential' in window) {
      
      console.log('Waiting for SMS. Try sending yourself a following message:\n\n' +
          'Your verification code is: 123ABC\n\n' +
          '@whatwebcando.today #123ABC');

          try {
            this.ac = new AbortController();
            const theotp = await navigator.credentials.get({
              otp: { transport:['sms'] },
              signal: this.ac.signal
            }).then(otp => {
              console.log('otp is ', otp);
              console.log(`otp, ${otp}`);
              this.setState({otp});
            }).catch(err => {
              console.log(`ssss ${err}`);
            });  
            console.log(theotp);
          } catch (error) {
            console.log(error);
          }
          
    } else {
      console.log('Web OTP API not supported');
    }
      
  }
  getBeneficiaries(){
    cowinApi.getBenefeciaries(this.state.token).then(data=>{
      this.setState({beneficiaries: data});
    }).catch(err=>{
      console.log(err);
      delete localStorage.token;
      this.setState({isAuthenticated: false, token: null})
    })
  }
  componentDidMount(){
    if(this.state.isAuthenticated){
      this.getBeneficiaries();
    }else if(this.state.mobile){
      // this.setState({enableOtp: true},()=>{this.generateOtp()})
      
    }

    cowinApi.getStates().then(data=>{
      this.setState({states: data.states},()=>{
        this.selectState(16);
        this.selectDistrict(265);
      })
    }).catch(err=>{
      console.log(err);
    })
    
    // const self = this;    
    Notification.requestPermission((status) => {
      console.log("Notification permission status:", status);
    });

    this.notifSound = document.getElementById("notif");
    this.notifSound.play();

      let opts = {
        title: "Vaccine Notifications Enabled",
        body: `You now have notifications active for Covid vaccine availability`,
        native: true,
        vibrate: [300, 100, 400]
      };
      try {
        Notification.requestPermission(function(result) {
          if (result === 'granted') {
            navigator.serviceWorker.ready.then(function(registration) {
              registration.showNotification(opts.title, opts);
            });
          }
        });
        new Notification(opts.title, opts);  
      } catch (error) {
        console.log(error);
      }
  }
  setStorage(){
    let state = Object.assign({}, this.state)
    delete state.vaccineCalendar;
    delete state.isWatchingAvailability;
    localStorage.appData = JSON.stringify(state);
  }
  componentWillUnmount() {
    // unsubscribe to ensure no memory leaks
    if(this.watcher) this.watcher.unsubscribe();
  }
  handleNotification(){
    let centers = this.state.vaccineCalendar.centers;
    centers.map(c=>{
      c.sessions.map(s=>{
        if (
          parseInt(s.min_age_limit) == this.state.minAge &&
          parseInt(s.available_capacity) > 0
        ) {
          this.setState({enableOtp: true})
          this.notifSound.play();

          let opts = {
            title: c.name,
            body: `${c.pincode} ${c.address} has ${s.available_capacity} on ${s.date}`,
            vibrate: [300, 100, 400],
            native: true
          }
          Notification.requestPermission(function(result) {
            if (result === 'granted') {
              navigator.serviceWorker.ready.then(function(registration) {
                registration.showNotification(opts.message, opts);
              });
            }
          });
          new Notification(opts.title, opts);  
          
        }
      })
    })
  }

  initWatch(zip) {
    const self = this;

    this.setState({isWatchingAvailability: true});
    if(this.state.selectedTab === "1"){
      this.watcher = cowinApi
      .initDist(this.state.districId, moment().format("DD-MM-YYYY"))
      .subscribe({
        next(data) {
          self.setState({sessions: data.sessions},()=>{
            // Fill this in
            // self.handleSessionNotification();
            // self.setStorage()
          })
        },
        error(err) {
          console.error("something wrong occurred: " + err);
        },
        complete() {
          console.log("done");
          this.setState({ isWatchingAvailability: false });
        },
      });
    }else{
      this.watcher = cowinApi
      .init(this.state.zip, moment().format("DD-MM-YYYY"))
      .subscribe({
        next(data) {
          self.setState({vaccineCalendar: data},()=>{
            self.handleNotification();
            self.setStorage()
          })
        },
        error(err) {
          console.error("something wrong occurred: " + err);
        },
        complete() {
          console.log("done");
          this.setState({ isWatchingAvailability: false });
        },
      });
    }
    
  }
  trackAuth() {
    const self = this;
    
    this.watcher = cowinApi
      .trackAuth(this.state.token)
      .subscribe({
        next(data) {
          self.setState({beneficiaries: data})
        },
        error(err) {
          console.error("something wrong occurred: " + err);
          this.setState({isAuthenticated: false})
        },
        complete() {
          console.log("done");
          this.setState({ isWatchingAvailability: false });
        },
      });
  }
  clearWatch() {
    cowinApi.clearWatch();
    this.setState({ isWatchingAvailability: false });
  }
  renderTable(vaccineCalendar){
    return <table style={{marginTop: 10}}>
    {vaccineCalendar.centers.map((vc) => {
      let noAvailability = true
      vc.sessions.map(ss=>{
        if(ss.available_capacity>0) noAvailability = false;
      })
      
      return (
        <tr key={vc.center_id}>
          <tc></tc>
          <td>
            <h3>{vc.name}</h3>
            {vc.block_name}, {vc.address}, {vc.pincode} 
          </td>
          
            
            {noAvailability ? <td>No Availability</td> : vc.sessions.map((s) => {
              return (
                <td key={s.session_id}>
                  <h4>{s.date}</h4>
                  <p>{s.vaccine}</p>
                  <div>
                    {parseInt(s.available_capacity) > 0
                      ? `${s.available_capacity} shots available for ${s.min_age_limit}+`
                      : "No Availability"}
                  </div>
                  {parseInt(s.available_capacity > 0) ? (
                    <div>
                      <b>Available Slots</b>
                      {s.slots.map((sl) => {
                        return <Row>{sl}</Row>;
                      })}
                    </div>
                  ) : null}
                </td>
              );
            })}
          

          {/* </th> */}
        </tr>
      );
    })}
  </table>
  }
  setMinAge(e){
    this.setState({minAge: e.target.value});
  }
  generateOtp(){
    this.setState({enableOtp: true}, ()=>{
      cowinApi.generateOtp(this.state.mobile).then(data=>{
        console.log(data);
        this.setState({otpData: data});
        // this.waitForOtp();
      }).catch(err=>{
        console.log(err);
        this.setState({enableOtp: false})
      })
    });
    
  }
  verifyOtp(){
    this.setState({enableOtp: false});
    cowinApi.verifyOtp(this.state.otp, this.state.otpData.txnId).then(data=>{
      console.log('otp verify ', data);
      localStorage.token = data.token;
      this.setState({token: data.token, isAuthenticated: true}, ()=>{
        this.getBeneficiaries();
        this.trackAuth();
      })
    }).catch(err=>{
      console.log(err);
      this.generateOtp();
    })
  }
  selectState(stateId){
    this.setState({stateId}, ()=>{
      cowinApi.getDistricts(stateId).then(data=>{
        this.setState({districs: data});
      }).catch(err=>{
        console.log(err)
      })
    })
  }
  selectDistrict(districtId){
    this.setState({districtId}, ()=>{
    })
  }
  renderSessions(){
    const sessions = this.state.sessions
  }
  render() {
    const vaccineCalendar = this.state.vaccineCalendar;
    const isAuthenticated = this.state.isAuthenticated;
    const {beneficiaries, selectedBeneficiaries} = this.state;
    return (
      <div className="App">
        {/* <Notifications /> */}
        <audio id="notif">
          <source src="https://assets.coderrocketfuel.com/pomodoro-times-up.mp3"></source>
        </audio>
        <header className="App-header">
          <h2>
            Get notifications for Covid-19 vaccine availability in your area
          </h2>
        </header>

        <Col style={{ marginBottom: 10 }}>
          {this.state.isWatchingAvailability ? null : (
            <title>Select age group for getting notifications</title>
          )}
        </Col>
        <Row gutter={{ xs: 8, sm: 16, md: 24, lg: 32 }}>
          <Col>
            {isAuthenticated ? null : (
              <div>
                <h1>Login</h1>
                {this.state.enableOtp ? null : (
                  <Search
                    placeholder= {this.state.mobile ? this.state.mobile : "Mobile Number"}
                    allowClear
                    type="number"
                    // value={this.state.mobile}
                    enterButton={"Generate OTP"}
                    size="large"
                    onSearch={(e) => {
                      this.setState({ mobile: e, enableOtp: true }, () => {
                        this.generateOtp();
                      });
                    }}
                  />
                )}
                {this.state.enableOtp ? (
                  <Search
                    placeholder="Enter OTP"
                    allowClear
                    type="number"
                    // value={this.state.zip}
                    enterButton={"Submit"}
                    size="large"
                    onSearch={(e) => {
                      console.log(e);
                      this.setState({ otp: e }, () => {
                        this.verifyOtp();
                      });
                    }}
                  />
                ) : null}
              </div>
            )}

            {isAuthenticated ? (
              <div>
                <h2>Beneficiaries</h2>
                {this.state.beneficiaries.length === 0 ? (
                  <p>
                    You do not have any benificiares added yet. Please login to{" "}
                    <a href="https://www.cowin.gov.in/home" target="_blank">
                      Cowin
                    </a>{" "}
                    and add beneficiaries
                  </p>
                ) : (
                  <p>Select beneficiaries to book a slot automatically when there's availability. This app can continuously track availability and make a booking.</p>
                )}
                {this.state.beneficiaries.map((b) => {
                  return (
                    <Row>
                      <Checkbox
                        checked={
                          selectedBeneficiaries.findIndex((sb) => {
                            return (
                              sb.beneficiary_reference_id ===
                              b.beneficiary_reference_id
                            );
                          }) !== -1
                        }
                        onClick={(e) => {
                          let sbs = this.state.selectedBeneficiaries;
                          let idx = sbs.findIndex((sb) => {
                            return (
                              sb.beneficiary_reference_id ===
                              b.beneficiary_reference_id
                            );
                          });
                          console.log(idx);
                          if (idx === -1) {
                            sbs.push(b);
                          } else {
                            sbs.splice(idx, 1);
                          }
                          this.setState({ selectedBeneficiaries: sbs });
                        }}
                      >
                        {b.name}
                      </Checkbox>
                    </Row>
                  );
                })}
              </div>
            ) : null}

            

            <h2 style={{marginTop: 15, marginBottom: 0}}>Select Location</h2>
            <Tabs
              defaultActiveKey="1"
              onChange={(e) => {
                this.setState({ selectedTab: e });
              }}
            >
              <TabPane tab="Track By District" key={1}>
                
                
                
                <Select
                  style={{ width: 234 }}
                  size="large"
                  defaultValue={16}
                  onChange={this.selectState.bind(this)}
                  placeholder="Select State"
                >
                  {this.state.states.map((s) => {
                    return (
                      <Option key={s.state_id} value={s.state_id}>
                        {s.state_name}
                      </Option>
                    );
                  })}
                </Select>
                
                <Select
                  style={{ width: 234 }}
                  defaultValue={265}
                  size="large"
                  onChange={val=>{this.selectDistrict(val)}}
                  placeholder="Select State"
                >
                  {this.state.districs.map((d) => {
                    return (
                      <Option key={d.district_id} value={d.district_id}>
                        {d.district_name}
                      </Option>
                    );
                  })}
                </Select>
                <Button type="primary" size="large" onClick={e=>this.initWatch()}>
                  Track Availability
                </Button>
                
                
              </TabPane>
              <TabPane tab="Track By Pincode" key={2}>
                <Search
                  disabled={this.state.isWatchingAvailability}
                  placeholder={
                    this.state.zip ? this.state.zip : "Enter your area pincode"
                  }
                  allowClear
                  type="number"
                  // value={this.state.zip}
                  enterButton={
                    this.state.isWatchingAvailability
                      ? `Tracking`
                      : `Track Availability`
                  }
                  size="large"
                  loading={this.state.isWatchingAvailability}
                  onSearch={(txt) => {
                    this.setState(
                      { zip: txt, isWatchingAvailability: true },
                      () => {
                        this.initWatch();
                      }
                    );
                  }}
                />
              </TabPane>
            </Tabs>

            <Radio.Group
            style={{marginTop: 10}}
              onChange={this.setMinAge.bind(this)}
              value={this.state.minAge}
              disabled={this.state.isWatchingAvailability}
            >
              <Radio value={18}>18 to 45 Years</Radio>
              <Radio value={45}>45+ Years</Radio>
            </Radio.Group>

            <Col>
              {this.state.isWatchingAvailability ? (
                <Button
                  type="primary"
                  icon={<CloseCircleOutlined />}
                  size={"large"}
                  danger
                  onClick={this.clearWatch.bind(this)}
                >
                  Stop
                </Button>
              ) : null}
            </Col>
          </Col>
        </Row>

        {vaccineCalendar && vaccineCalendar.centers
          ? this.renderTable(vaccineCalendar)
          : null}
          {this.state.session ? this.renderSessions():null}
      </div>
    );
  }
}
export default App;