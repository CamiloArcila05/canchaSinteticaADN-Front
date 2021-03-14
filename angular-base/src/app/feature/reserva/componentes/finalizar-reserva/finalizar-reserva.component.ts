import { Component, OnInit } from '@angular/core';
import {Reserva} from '../../shared/model/reserva';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {ReservaService} from '../../shared/service/reserva.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {ToastrService} from 'ngx-toastr';
import {Cancha} from '../../../cancha/shared/model/cancha';
import {CanchaService} from '../../../cancha/shared/service/cancha.service';
import {FormControl, Validators} from '@angular/forms';

const RANGO_HORA_CAMBIO_VALOR = 17;


@Component({
  selector: 'app-finalizar-reserva',
  templateUrl: './finalizar-reserva.component.html',
  styleUrls: ['./finalizar-reserva.component.scss']
})
export class FinalizarReservaComponent implements OnInit {

  reservaFinalizar: Reserva;
  canchaSeleccionada: Cancha;
  loading = false;

  valorRestante = new FormControl(0, [Validators.required, Validators.min(0)]);

  constructor(private modalService: NgbModal,
              private reservaService: ReservaService,
              private canchaService: CanchaService,
              private spinner: NgxSpinnerService,
              private toast: ToastrService) { }

  ngOnInit(): void {
    this.reservaFinalizar = JSON.parse(localStorage.getItem('reservaSeleccionada'));
    this.loading = true;
    this.canchaService.consultar()
      .subscribe(
        (response) => {
          this.loading = false;
          response.forEach(
            (item) => {
              if (item.id === this.reservaFinalizar.canchaId) {
                this.canchaSeleccionada = item;
              }
            });
        });
  }

  cancelar() {
    this.modalService.dismissAll('cancelar');
  }
  aceptar() {
    this.spinner.show();
    this.reservaService.finalizar(this.reservaFinalizar.id, this.valorRestante.value)
      .subscribe(
        () => {
          this.spinner.hide();
          this.toast.success('La reserva ha sido finalizada exitosamente', 'Exito');
          this.modalService.dismissAll('exito');
        },
        (error) => {
          this.spinner.hide();
          if (error.error) {
            this.toast.error(error.error.mensaje, 'Error');
          } else {
            this.toast.error('Ocurrio un error inesperado, contacte al administrador del sistema', 'Error');
          }
        }
        );
  }

  getValorCancha(): number {
    const hora = Number(this.reservaFinalizar.hora.split(':')[0]);
    let valorCancha = 0;
    if (hora < RANGO_HORA_CAMBIO_VALOR) {
      valorCancha = this.canchaSeleccionada.valorDia;
    }

    if (hora > RANGO_HORA_CAMBIO_VALOR) {
      valorCancha = this.canchaSeleccionada.valorNoche;
    }
    return valorCancha;
  }

}
