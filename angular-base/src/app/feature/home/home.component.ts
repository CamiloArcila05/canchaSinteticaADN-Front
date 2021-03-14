import { Component, OnInit } from '@angular/core';
import {CanchaService} from '../cancha/shared/service/cancha.service';
import {ReservaService} from '../reserva/shared/service/reserva.service';
import {ToastrService} from "ngx-toastr";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  canchasActivas = 0;
  canchasInactivas = 0;
  canchasTotal = 0;

  reservasActivas = 0;
  reservasCanceladas = 0;
  reservasFinalizadas = 0;
  reservasTotal = 0;

  constructor(private canchaService: CanchaService,
              private toast: ToastrService,
              private reservaService: ReservaService) { }

  ngOnInit() {
    this.canchaService.consultar()
      .subscribe(
        (response) => {
          this.canchasTotal = response.length;
          response.forEach(
            (item) => {
              if (item.estado === 'ACTIVO') {
                this.canchasActivas++;
              }

              if (item.estado === 'INACTIVO') {
               this.canchasInactivas++;
              }
            });
        },

        () => {
          this.toast.error('Ocurrio un error al consultar la informacion de las canchas', 'Error');
        }
      );

    this.reservaService.consultar()
      .subscribe(
        (response) => {
          this.reservasTotal = response.length;
          response.forEach(
            (item) => {
              if (item.estado === 'ACTIVO') {
                this.reservasActivas++;
              }

              if (item.estado === 'CANCELADA') {
                this.reservasCanceladas++;
              }

              if (item.estado === 'FINALIZADA') {
                this.reservasFinalizadas++;
              }
            }
          );
        },

        () => {
          this.toast.error('Ocurrio un error al consultar la informacion de las reservas', 'Error');
        }
      );

    console.log(this.reservasFinalizadas);
  }

}
