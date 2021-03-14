import { Component, OnInit, Input } from '@angular/core';
import { MenuItem } from '@core/modelo/menu-item';

@Component({
  selector: 'app-navbar',
  templateUrl: 'navbar.component.html',
  styles: [`:host {
    border: 0 solid #535050;
    border-bottom-width: 5px;
    display: block;
    height: 60px;
    padding: 0 16px;
  }

  nav a {
    color: #070000;
    font-size: 20px;
    font-weight: 700;
    line-height: 48px;
    margin-right: 50px;
    text-decoration: none;
    vertical-align: middle;
    cursor: pointer;
  }

  nav a.router-link-active {
    color: #106cc8;
  }`],
})
export class NavbarComponent implements OnInit {

  @Input()
  items: MenuItem[];

  constructor() { }

  ngOnInit() {
  }

}
